import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from local_proxy import annual_drawdown_counts, nasdaq100_return_history
import test_nasdaq_returns

class DrawdownFrequencyTests(unittest.TestCase):
    def test_year_reset_and_api_contract(self):
        rows = nasdaq100_return_history(test_nasdaq_returns.NasdaqReturnTests().payload(), "test")["rows"]
        self.assertEqual([row["drawdownCounts"]["20"] for row in rows], [1, 1])
        self.assertEqual([row["drawdownCounts"]["25"] for row in rows], [0, 0])

    def test_episodes(self):
        points = list(enumerate([100,90,91,89,65,100,90]))
        self.assertEqual(annual_drawdown_counts(points), {'10':2,'15':1,'20':1,'25':1,'30':1,'35':1,'40':0,'60':0,'80':0})
        self.assertEqual(annual_drawdown_counts([(0,100),(1,20)])['80'],1)
        self.assertIsNone(annual_drawdown_counts([(0,100)]))

if __name__ == '__main__':
    unittest.main()
