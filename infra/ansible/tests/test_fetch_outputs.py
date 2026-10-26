import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    'fetch_outputs', Path(__file__).parents[1] / 'scripts/fetch_outputs.py')
fetch_outputs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetch_outputs)


class FetchOutputsTest(unittest.TestCase):
    def run_fetch(self, state, target):
        response = io.BytesIO(json.dumps(state).encode())
        with patch.dict(os.environ, {'CI_API_V4_URL': 'https://gitlab.example/api/v4',
                                     'CI_PROJECT_ID': '123', 'CI_JOB_TOKEN': 'test-token',
                                     'TF_STATE_NAME': 'bootstrap'}), \
                patch('sys.argv', ['fetch_outputs.py', '--output', str(target)]), \
                patch.object(fetch_outputs.urllib.request, 'urlopen', return_value=response) as request:
            fetch_outputs.main()
        self.assertEqual(request.call_args.args[0].full_url,
                         'https://gitlab.example/api/v4/projects/123/terraform/state/bootstrap')

    def test_writes_outputs_without_state_resources(self):
        outputs = {'gateway': {'value': {'public_ip': '198.51.100.1'}},
                   'workers': {'value': {}}}
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'outputs.json'
            self.run_fetch({'outputs': outputs, 'resources': [{'private': 'secret'}]}, target)
            self.assertEqual(json.loads(target.read_text()), outputs)

    def test_missing_infrastructure_outputs_fails_without_writing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'outputs.json'
            with self.assertRaises(ValueError):
                self.run_fetch({'outputs': {}}, target)
            self.assertFalse(target.exists())
