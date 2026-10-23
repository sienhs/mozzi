import base64
import json
from pathlib import Path
import unittest

import jinja2
import yaml

ROOT = Path(__file__).parents[1]


class TemplatesTest(unittest.TestCase):
    def setUp(self):
        self.env = jinja2.Environment(undefined=jinja2.StrictUndefined)
        self.env.filters.update(to_json=json.dumps,
                                b64decode=lambda value: base64.b64decode(value).decode())
        self.groups = {'all': ['ssafy', 'gateway', 'worker-1', 'worker-2'],
                       'vpn_gateway': ['gateway'], 'k3s_server': ['ssafy']}
        self.hostvars = {
            name: {'vpn_ip': f'10.200.0.{i}', 'vpn_public_key': {'stdout': f'public-{name}'}}
            for name, i in zip(self.groups['all'], [1, 2, 11, 12])
        }
        self.hostvars['ssafy']['k3s_join_token'] = {
            'content': base64.b64encode(b'test-token').decode()}
        self.context = dict(groups=self.groups, hostvars=self.hostvars,
                            vpn_interface='wg0', vpn_port=51820, vpn_mtu=1380,
                            vpn_cidr='10.200.0.0/24', gateway_public_ip='198.51.100.10',
                            gateway_private_ip='10.50.1.10',
                            vpn_private_key={'content': base64.b64encode(b'test-key').decode()})

    def render(self, path, **values):
        return self.env.from_string((ROOT / path).read_text()).render(**(self.context | values))

    def test_hub_has_three_peers_and_spokes_have_correct_endpoints(self):
        path = 'roles/wireguard/templates/wg0.conf.j2'
        hub = self.render(path, inventory_hostname='gateway', vpn_ip='10.200.0.2')
        self.assertEqual(hub.count('[Peer]'), 3)
        self.assertNotIn('Endpoint', hub)
        server = self.render(path, inventory_hostname='ssafy', vpn_ip='10.200.0.1')
        worker = self.render(path, inventory_hostname='worker-1', vpn_ip='10.200.0.11')
        self.assertIn('Endpoint = 198.51.100.10:51820', server)
        self.assertIn('Endpoint = 10.50.1.10:51820', worker)

    def test_server_and_agent_config_are_valid_yaml_and_share_vpn_interface(self):
        path = 'roles/k3s/templates/config.yaml.j2'
        values = dict(k3s_node_name='test', vpn_ip='10.200.0.1',
                      k3s_pod_cidr='10.42.0.0/16', k3s_service_cidr='10.43.0.0/16')
        server = yaml.safe_load(self.render(path, k3s_is_server=True, **values))
        worker = yaml.safe_load(self.render(path, k3s_is_server=False, **values))
        self.assertNotIn('token', server)
        self.assertEqual(worker['token'], 'test-token')
        self.assertEqual(worker['server'], 'https://10.200.0.1:6443')
        self.assertEqual(server['flannel-iface'], worker['flannel-iface'])

    def test_gateway_forwards_tunnel_peers_without_nat(self):
        rules = self.render('roles/gateway/templates/nftables.conf.j2',
                            private_subnet_cidr='10.50.11.0/24',
                            ansible_facts={'default_ipv4': {'interface': 'ens5'}})
        self.assertIn('iifname "wg0" oifname "wg0"', rules)
        self.assertIn('ip daddr != { 10.50.0.0/16, 10.200.0.0/24 }', rules)


if __name__ == '__main__':
    unittest.main()
