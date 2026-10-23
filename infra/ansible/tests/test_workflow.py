from pathlib import Path
import unittest

import yaml

ROOT = Path(__file__).parents[1]


class BootstrapOrderTest(unittest.TestCase):
    def test_nat_is_configured_before_workers_need_package_downloads(self):
        plays = yaml.safe_load((ROOT / 'site.yml').read_text())
        plays = [play for play in plays if play['hosts'] != 'localhost']
        self.assertEqual(plays[0]['hosts'], 'vpn_gateway')
        self.assertEqual(plays[0]['roles'], ['common', 'gateway'])
        self.assertEqual(plays[1]['hosts'], 'k3s_server:k3s_agents')
        network_checks = [task for task in plays[1]['pre_tasks']
                          if task.get('ansible.builtin.wait_for', {}).get('host') == 'archive.ubuntu.com']
        self.assertEqual(len(network_checks), 1)
        self.assertIn('common', plays[1]['roles'])

    def test_inventory_is_checked_locally_before_any_remote_work(self):
        plays = yaml.safe_load((ROOT / 'site.yml').read_text())
        self.assertEqual(plays[0]['hosts'], 'localhost')
        self.assertFalse(plays[0]['become'])
        checks = plays[0]['tasks'][0]['ansible.builtin.assert']['that']
        self.assertTrue(any("groups.get('all', [])" in condition for condition in checks))


if __name__ == '__main__':
    unittest.main()
