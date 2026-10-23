import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('inventory', Path(__file__).parents[1] / 'scripts/inventory.py')
inventory = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inventory)


class InventoryTest(unittest.TestCase):
    def setUp(self):
        self.outputs = {
            'gateway': {'value': {'public_ip': '198.51.100.10', 'private_ip': '10.50.1.10'}},
            'workers': {'value': {'worker-1': {'private_ip': '10.50.11.10'},
                                  'worker-2': {'private_ip': '10.50.11.11'}}},
        }

    def test_private_workers_use_gateway_and_distinct_vpn_addresses(self):
        result = inventory.build(self.outputs, 'ssafy.example.invalid', '/keys/ssafy.pem', '/keys/personal.pem')
        hosts = result['all']['hosts']
        self.assertEqual(len({h['vpn_ip'] for h in hosts.values()}), 4)
        self.assertIn('ubuntu@198.51.100.10', hosts['worker-1']['ansible_ssh_common_args'])
        self.assertEqual(hosts['ssafy']['ansible_ssh_private_key_file'], '/keys/ssafy.pem')
        self.assertNotIn('private_key', result['all']['vars'])

    def test_reject_old_multi_az_inventory(self):
        self.outputs['workers']['value'] = {'apne2-az2': {'private_ip': '10.50.1.10'}}
        with self.assertRaises(ValueError):
            inventory.build(self.outputs, 'ssafy.example.invalid', 'ssafy.pem', 'personal.pem')

    def test_reject_shell_metacharacters_in_host(self):
        with self.assertRaises(ValueError):
            inventory.build(self.outputs, 'host;echo bad', 'ssafy.pem', 'personal.pem')


if __name__ == '__main__':
    unittest.main()
