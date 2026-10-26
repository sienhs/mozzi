"""Read only the outputs from GitLab Terraform state; never run plan/apply."""
import argparse
import base64
import json
import os
from pathlib import Path
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    state_name = os.environ.get('TF_STATE_NAME', 'bootstrap')
    url = (f"{os.environ['CI_API_V4_URL']}/projects/"
           f"{os.environ['CI_PROJECT_ID']}/terraform/state/{state_name}")
    auth = base64.b64encode(
        f"gitlab-ci-token:{os.environ['CI_JOB_TOKEN']}".encode()).decode()
    request = urllib.request.Request(url, headers={'Authorization': f'Basic {auth}'})
    # Keep the complete state (which may contain secrets) in memory only.
    with urllib.request.urlopen(request, timeout=60) as response:
        outputs = json.load(response).get('outputs', {})
    if not {'gateway', 'workers'} <= outputs.keys():
        raise ValueError('State has no gateway/workers outputs; provision infrastructure first.')
    Path(args.output).write_text(json.dumps(outputs), encoding='utf-8')


if __name__ == '__main__':
    main()
