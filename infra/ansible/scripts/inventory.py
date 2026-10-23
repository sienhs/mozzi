"""Build an inventory from Terraform output; never read or write private keys."""
import argparse
import ipaddress
import json
import os
from pathlib import Path
import shlex


def build(outputs, ssafy_host, ssafy_key, personal_key):
    if not ssafy_host or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-' for c in ssafy_host):
        raise ValueError('SSAFY_HOST must be a hostname or IPv4 address')
    gateway = outputs['gateway']['value']
    workers = outputs['workers']['value']
    if set(workers) != {'worker-1', 'worker-2'}:
        raise ValueError('Expected worker-1 and worker-2 from the single-AZ Terraform root')
    gateway_ip = str(ipaddress.IPv4Address(gateway['public_ip']))
    gateway_private = str(ipaddress.IPv4Address(gateway['private_ip']))
    jump = 'ssh -o StrictHostKeyChecking=yes -o IdentitiesOnly=yes -i {} -W %h:%p ubuntu@{}'.format(
        shlex.quote(str(Path(personal_key).resolve())), gateway_ip)
    hosts = {
        'ssafy': {'ansible_host': ssafy_host, 'ansible_ssh_private_key_file': ssafy_key,
                  'vpn_ip': '10.200.0.1', 'k3s_node_name': 'mozzi-server'},
        'gateway': {'ansible_host': gateway_ip, 'ansible_ssh_private_key_file': personal_key,
                    'vpn_ip': '10.200.0.2'},
    }
    for index, name in enumerate(sorted(workers), 11):
        hosts[name] = {
            'ansible_host': str(ipaddress.IPv4Address(workers[name]['private_ip'])),
            'ansible_ssh_private_key_file': personal_key,
            'ansible_ssh_common_args': '-o ProxyCommand=' + shlex.quote(jump),
            'vpn_ip': f'10.200.0.{index}', 'k3s_node_name': name,
        }
    return {'all': {'vars': {'ansible_user': 'ubuntu', 'ansible_become': True,
                            'gateway_public_ip': gateway_ip, 'gateway_private_ip': gateway_private},
                    'hosts': hosts,
                    'children': {'vpn_gateway': {'hosts': {'gateway': {}}},
                                 'k3s_server': {'hosts': {'ssafy': {}}},
                                 'k3s_agents': {'hosts': {name: {} for name in workers}}}}}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--terraform-output', required=True)
    parser.add_argument('--output', default='inventory.generated.json')
    parser.add_argument('--ssafy-host', default=os.getenv('SSAFY_HOST'))
    parser.add_argument('--ssafy-key', default=os.getenv('SSAFY_SSH_KEY'))
    parser.add_argument('--personal-key', default=os.getenv('PERSONAL_SSH_KEY'))
    args = parser.parse_args()
    for key in (args.ssafy_key, args.personal_key):
        if not key or not Path(key).is_file():
            parser.error('Provide existing SSAFY and personal private key file paths')
    inventory = build(json.loads(Path(args.terraform_output).read_text(encoding='utf-8-sig')),
                      args.ssafy_host, str(Path(args.ssafy_key).resolve()), str(Path(args.personal_key).resolve()))
    target = Path(args.output)
    target.write_text(json.dumps(inventory, indent=2) + '\n', encoding='utf-8')
    target.chmod(0o600)


if __name__ == '__main__':
    main()
