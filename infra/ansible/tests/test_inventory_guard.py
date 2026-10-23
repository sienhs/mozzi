"""Run only the local inventory guard, skipping remote tasks and fact gathering."""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).parents[1]


@unittest.skipUnless(importlib.util.find_spec('ansible'), 'Ansible is required for playbook regression tests')
class InventoryGuardTest(unittest.TestCase):
    def run_guard(self, inventory):
        return subprocess.run(
            [sys.executable, '-m', 'ansible.cli.playbook', '-i', str(inventory),
             str(ROOT / 'site.yml'), '--tags', 'inventory-check', '--skip-tags', 'always'],
            cwd=ROOT, env=os.environ | {'ANSIBLE_CONFIG': str(ROOT / 'ansible.cfg'),
                                        'ANSIBLE_NOCOLOR': '1'},
            capture_output=True, text=True, timeout=60,
        )

    def test_empty_inventory_cannot_succeed(self):
        with tempfile.TemporaryDirectory() as directory:
            inventory = Path(directory) / 'empty.json'
            inventory.write_text('{}')
            result = self.run_guard(inventory)
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('Inventory is missing or incomplete', result.stdout + result.stderr)

    def test_expected_inventory_passes_local_guard(self):
        result = self.run_guard(ROOT / 'inventory.example.yml')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('All assertions passed', result.stdout)


if __name__ == '__main__':
    unittest.main()
