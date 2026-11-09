from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import urlopen

from scripts.liquidity_signals import build_report, normalize_points, score_label
from scripts.liquidity_data import (load_series, wind_fetch_all, fred_series, rrp_series,
                                   margin_series, south_series, spx_sina, closed_daily_points)
from scripts.local_proxy import create_server

TODAY = date(2026, 11, 5)


def series(values, offset=0, status='ok'):
    return {'points': [{'date': (TODAY - timedelta(days=len(values)-1-i+offset)).isoformat(), 'value': v}
                       for i, v in enumerate(values)], 'status': status, 'source': 'test'}


def one(key, values, metric=None, **kwargs):
    report = build_report({key: series(values, **kwargs)}, TODAY)
    return next(row for row in report['metrics'] if row['id'] == metric)


class LiquidityScoringTests(unittest.TestCase):
    def test_score_mapping_all_boundaries(self):
        self.assertEqual([score_label(s) for s in [-4,-3,-2,-1,0,1,2,3,4]],
                         ['紧张','紧张','偏紧','偏紧','中性','偏松','偏松','宽松','宽松'])

    def test_all_missing_is_not_neutral_and_cannot_clear_alerts(self):
        report = build_report({}, TODAY)
        self.assertIsNone(report['markets']['cn']['score'])
        self.assertEqual(report['markets']['us']['label'], '数据不足')
        self.assertFalse(report['alertsComplete'])

    def test_vix_strict_thresholds(self):
        for value, score in [(19.99,1),(20,0),(25,0),(25.01,-2)]:
            self.assertEqual(one('us_VIX', [value], 'vix')['score'], score)

    def test_yield_bp_threshold_includes_boundary(self):
        for value, score in [(3.9,1),(4.1,-1),(4.09,0)]:
            self.assertEqual(one('us_DGS10', [4]*20+[value], 'yield')['score'], score)

    def test_margin_financing_percent_and_shibor_bp(self):
        self.assertEqual(one('cn_margin', [100]*5+[100.5], 'margin')['score'], 1)
        self.assertEqual(one('cn_margin', [100]*5+[99.5], 'margin')['score'], -1)
        self.assertEqual(one('cn_shibor', [2]*5+[1.95], 'shibor')['score'], 1)

    def test_rrp_rule_is_blank_and_never_enters_score(self):
        for values in ([100]*20+[95], [100]*20+[95.1], [0]*21):
            metric=one('us_RRP', values, 'rrp')
            self.assertIsNone(metric['score'])
            self.assertTrue(metric['pendingRule'])
            self.assertTrue(metric['reference'])

    def test_dxy_daily_trend_represents_dollar_strength(self):
        self.assertEqual(one('us_DXY_HISTORY',[100]*20+[99],'usd')['score'],1)
        self.assertEqual(one('us_DXY_HISTORY',[100]*20+[101],'usd')['score'],-1)
        self.assertEqual(one('us_DXY_HISTORY',[100]*21,'usd')['score'],0)

    def test_curve_joins_by_date_not_array_position(self):
        ten = series([3]*20+[4]); two = series([2]*21)
        two['points'].append({'date':'2026-11-06', 'value':99})
        report = build_report({'us_DGS10':ten,'us_DGS2':two},TODAY)
        curve = next(x for x in report['metrics'] if x['id']=='curve')
        self.assertEqual(curve['value'],2)
        self.assertEqual(curve['score'],1)

    def test_ma_uses_full_sample_and_equal_is_neutral(self):
        self.assertIsNone(one('us_SP500', [100]*199, 'spx')['score'])
        self.assertEqual(one('us_SP500', [100]*200, 'spx')['score'], 0)
        self.assertEqual(one('cn_CSI300', [100]*249+[90], 'csi300')['score'], -1)

    def test_current_inversion_warns_even_without_twenty_day_history(self):
        report=build_report({'us_DGS10':series([3]),'us_DGS2':series([4])},TODAY)
        curve=next(m for m in report['metrics'] if m['id']=='curve')
        self.assertEqual(curve['score'],-1)
        self.assertIn('10Y−2Y 利差倒挂',report['alerts'])

    def test_old_or_failed_cache_excluded_but_visible(self):
        for kwargs in [{'offset':8}, {'status':'stale'}]:
            metric=one('us_VIX',[30],'vix',**kwargs)
            self.assertEqual(metric['value'],30)
            self.assertIsNone(metric['score'])
            self.assertEqual(metric['status'],'stale')

    def test_weekly_age_and_missing_reference_do_not_change_denominator(self):
        data={'us_WALCL':series([5000,5100],offset=10),'cn_south':series([100]),'us_DXY':series([102])}
        report=build_report(data,TODAY)
        self.assertEqual(report['markets']['us']['valid'],1)
        self.assertEqual(report['markets']['us']['total'],6)
        self.assertIsNone(report['markets']['cn']['score'])

    def test_flow_is_sum_of_five_including_latest(self):
        metric=one('cn_flow',[1000,-10,-10,-10,-10,1],'flow')
        self.assertEqual(metric['change'],-39)
        self.assertEqual(metric['score'],-1)

    def test_invalid_and_future_values_never_score(self):
        rows=[{'date':'2026-11-05','value':None},{'date':'2026-11-04','value':float('inf')},
              {'date':'2026-11-06','value':100},{'date':'bad','value':1},{'date':'2026-11-03','value':0}]
        self.assertEqual(normalize_points(rows,TODAY),[{'date':'2026-11-03','value':0}])


class LiquidityDataTests(unittest.TestCase):
    def test_intraday_quotes_are_excluded_from_daily_scoring(self):
        points=[{'date':'2026-11-04','value':1},{'date':'2026-11-05','value':2}]
        morning=datetime(2026,11,5,6,tzinfo=timezone.utc)
        self.assertEqual(len(closed_daily_points(points,'cn',morning)),1)
        self.assertEqual(len(closed_daily_points(points,'cn',morning+timedelta(hours=2))),2)
        self.assertEqual(len(closed_daily_points(points,'us',morning+timedelta(hours=14))),1)
        self.assertEqual(len(closed_daily_points(points,'us',morning+timedelta(hours=16))),2)

    def test_fred_units_and_missing_observation(self):
        result=fred_series('WALCL', .001, lambda _: 'observation_date,WALCL\n2026-11-04,6600000\n2026-11-05,.\n', TODAY)
        self.assertEqual(result[0],[{'date':'2026-11-04','value':6600}])

    def test_rrp_dollars_to_billions(self):
        fetch=lambda _: json.dumps({'repo':{'operations':[{'operationDate':'2026-11-04','totalAmtAccepted':225000000}]}})
        self.assertEqual(rrp_series(fetch,TODAY)[0][0]['value'],.225)

    def test_margin_uses_financing_not_total_margin(self):
        fetch=lambda _: json.dumps({'result':{'data':[{'DIM_DATE':'2026-11-04 00:00:00','RZYE':2e12,'RZRQYE':3e12}]}})
        self.assertEqual(margin_series(fetch)[0][0]['value'],20000)

    def test_south_requires_both_channels_same_date(self):
        rows=[{'TRADE_DATE':'2026-11-04','MUTUAL_TYPE':'002','NET_DEAL_AMT':1000},
              {'TRADE_DATE':'2026-11-04','MUTUAL_TYPE':'004','NET_DEAL_AMT':500},
              {'TRADE_DATE':'2026-11-05','MUTUAL_TYPE':'002','NET_DEAL_AMT':100}]
        self.assertEqual(south_series(lambda _:json.dumps({'result':{'data':rows}}))[0],
                         [{'date':'2026-11-04','value':15}])

    def test_sina_jsonp_is_parsed_without_executing_script(self):
        text='/* comment */\nvar data=([{"d":"2026-11-04","c":"6000"}]);'
        self.assertEqual(spx_sina(lambda _:text)[0],[{'date':'2026-11-04','value':'6000'}])
        with self.assertRaises(ValueError): spx_sina(lambda _:'alert(1)')

    def test_cache_force_failure_preserves_history_and_stale_marker(self):
        with TemporaryDirectory() as temporary:
            root=Path(temporary); calls=[]
            def success():
                calls.append(1); return [{'date':'2026-11-05','value':18}], 'test', 'https://example.org'
            fresh=load_series('us_VIX',[success],root,today=TODAY)
            cached=load_series('us_VIX',[success],root,today=TODAY)
            self.assertEqual(len(calls),1); self.assertTrue(cached['cached'])
            def fail(): raise TimeoutError('private details')
            failed=load_series('us_VIX',[fail],root,True,TODAY)
            self.assertEqual(failed['points'],fresh['points']); self.assertEqual(failed['status'],'stale')
            self.assertNotIn('private details',failed['error'])
            self.assertEqual(load_series('us_VIX',[fail],root,today=TODAY)['status'],'stale')
            self.assertEqual(load_series('us_VIX',[success],root,True,TODAY)['status'],'ok')

    def test_provider_fallback_and_wind_unit_validation(self):
        with TemporaryDirectory() as temporary:
            root=Path(temporary)
            def fail(): raise ValueError()
            good=lambda:([{'date':'2026-11-05','value':18}],'fallback','https://example.org')
            self.assertEqual(load_series('us_VIX',[fail,good],root,today=TODAY)['source'],'fallback')
            (root/'wind').mkdir()
            (root/'wind/us_VIX.json').write_text(json.dumps({'id':'us_VIX','unit':'错误单位','source':'Wind','points':[{'date':'2026-11-05','value':18}]}),encoding='utf-8')
            self.assertEqual(wind_fetch_all(root,TODAY)['us_VIX']['status'],'missing')

    def test_http_endpoint_refresh_validation_and_no_arbitrary_provider(self):
        with patch('scripts.liquidity_data.liquidity_snapshot', return_value={'schemaVersion':1}) as snapshot:
            server=create_server(port=0); thread=Thread(target=server.serve_forever,daemon=True);thread.start()
            base='http://127.0.0.1:'+str(server.server_address[1])
            try:
                with urlopen(base+'/api/liquidity?refresh=1') as response:
                    self.assertEqual(json.load(response)['schemaVersion'],1)
                self.assertTrue(snapshot.call_args.kwargs['force'])
                for query in ['refresh=2','refresh=1&refresh=1','provider=wind','url=https://example.org']:
                    with self.assertRaises(HTTPError) as error: urlopen(base+'/api/liquidity?'+query)
                    self.assertEqual(error.exception.code,400)
            finally:
                server.shutdown();server.server_close();thread.join()

    def test_etf_status_endpoint_is_read_only_and_preserves_success_timestamp(self):
        with patch('scripts.liquidity_data.read_etf_metric', return_value={'id':'cn_etf_flow','updatedAt':'2026-11-06T01:03:00Z'}) as read:
            server=create_server(port=0);thread=Thread(target=server.serve_forever,daemon=True);thread.start()
            base='http://127.0.0.1:'+str(server.server_address[1])
            try:
                with urlopen(base+'/api/liquidity/etf') as response:
                    self.assertEqual(json.load(response)['metric']['updatedAt'],'2026-11-06T01:03:00Z')
                with self.assertRaises(HTTPError) as error: urlopen(base+'/api/liquidity/etf?refresh=1')
                self.assertEqual(error.exception.code,400)
                self.assertEqual(read.call_count,1)
            finally:
                server.shutdown();server.server_close();thread.join()


if __name__ == '__main__': unittest.main()
