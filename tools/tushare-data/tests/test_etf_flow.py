import copy
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from tushare_client import TushareClientError
from tushare_etf_flow import estimate_day, etf_flow_history

DAY, PREV = '2026-11-05', '2026-11-04'


class ETFTests(unittest.TestCase):
    def inputs(self):
        fund = {'ts_code': '510300.SH', 'name': '沪深300ETF', 'fund_type': '股票型', 'list_date': '2010-01-01'}
        shares = [{'ts_code': fund['ts_code'], 'trade_date': DAY, 'fd_share': 11000}]
        prior = [{**shares[0], 'trade_date': PREV, 'fd_share': 10000}]
        nav = [{'ts_code': fund['ts_code'], 'nav_date': DAY, 'unit_nav': 2, 'adj_nav': 2}]
        old_nav = [{**nav[0], 'nav_date': PREV}]
        return [[fund], shares, prior, nav, old_nav]

    def test_units_signed_flow_and_no_price_flow(self):
        data = self.inputs()
        r = estimate_day(DAY, PREV, *data)
        self.assertEqual(r['net_flow_yi'], .2)
        data[1][0]['fd_share'] = 9000
        self.assertEqual(estimate_day(DAY, PREV, *data)['net_flow_yi'], -.2)
        data[1][0]['fd_share'] = 10000
        data[3][0].update(unit_nav=3, adj_nav=3)
        self.assertEqual(estimate_day(DAY, PREV, *data)['net_flow_yi'], 0)

    def test_split_not_treated_as_inflow(self):
        data = self.inputs()
        data[1][0]['fd_share'] = 30000
        data[3][0].update(unit_nav=2/3, adj_nav=2)
        r = estimate_day(DAY, PREV, *data)
        self.assertIsNone(r['net_flow_yi'])
        self.assertIsNone(r['sample_net_flow_yi'])
        self.assertEqual(r['excluded'][0]['reason'], 'corporate_action_review')

    def test_partial_sample_never_claims_full_total(self):
        data = self.inputs()
        data[0].append({**data[0][0], 'ts_code': '159919.SZ'})
        r = estimate_day(DAY, PREV, *data)
        self.assertFalse(r['complete'])
        self.assertIsNone(r['net_flow_yi'])
        self.assertEqual(r['sample_net_flow_yi'], .2)
        self.assertEqual(r['coverage']['received'], 1)
        self.assertEqual(r['coverage']['expected'], 2)

    def test_scope_and_listing_dates(self):
        data = self.inputs()
        for name, kind, listing, code in [('QDII ETF','股票型','2010-01-01','513100.SH'),
                ('ETF联接','股票型','2010-01-01','160001.SZ'), ('债券ETF','债券型','2010-01-01','511000.SH'),
                ('新ETF','股票型',DAY,'159123.SZ'), ('未来ETF','股票型','2026-12-01','159124.SZ')]:
            data[0].append({'name':name,'fund_type':kind,'list_date':listing,'ts_code':code})
        r=estimate_day(DAY,PREV,*data)
        self.assertEqual(r['coverage']['expected'],1)
        self.assertEqual(r['coverage']['newly_listed'],['159123.SZ'])

    def test_wrong_date_duplicate_and_missing_nav_rejected(self):
        for modify in ('date','duplicate'):
            data=self.inputs()
            if modify=='date':data[3][0]['nav_date']=PREV
            else:data[1].append(copy.deepcopy(data[1][0]))
            with self.assertRaises(TushareClientError):estimate_day(DAY,PREV,*data)
        data=self.inputs();data[3][0]['unit_nav']=None
        self.assertEqual(estimate_day(DAY,PREV,*data)['excluded'][0]['reason'],'missing_nav_or_adjustment')

    def test_bounded_history_and_truncation(self):
        with self.assertRaises(TushareClientError):etf_flow_history(None,'2026-01-01',DAY)
        class Client:
            def call(self, method, **kwargs):
                if method=='trade_cal':return [{'cal_date':DAY,'pretrade_date':PREV,'is_open':1}]
                if method=='fund_basic':return [{'ts_code':'510300.SH'}]
                if method=='fund_share':return [{}]*2000
        with self.assertRaises(TushareClientError):etf_flow_history(Client(),DAY,DAY)
