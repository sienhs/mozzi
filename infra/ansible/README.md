# VPN 및 k3s 자동 구성

Terraform은 AWS 자원만 만들고, 이 디렉터리의 Ansible은 Ubuntu 서버 내부 설정을 전담한다.
SSAFY 1대(server), Public VPN/NAT gateway 1대, Private worker 2대가 대상이다.
Linux/WSL 또는 CI에서 실행한다. Windows 네이티브는 Ansible 실행 환경으로 지원하지 않는다.

## 실행 흐름

1. Terraform output JSON으로 inventory를 생성한다.
2. Public gateway에 먼저 접속해 패키지, NAT 및 IP forwarding을 구성한다.
3. Private worker의 인터넷 연결을 확인한 뒤 SSAFY와 worker의 패키지 및 방화벽을 구성한다.
4. 서버 내부에서 WireGuard 개인 키를 생성하고 공개 키를 교환한다.
5. gateway 중심 hub VPN을 구성하고 노드 사이 ping을 검증한다.
6. SSAFY에 k3s server, worker에 k3s agent를 설치한다.
7. 노드 Ready, Traefik, DNS/ClusterIP 및 양쪽 worker Pod로의 HTTP 통신을 검사한다.
   검사 namespace는 성공/실패 후 삭제한다.

Terraform에는 user_data나 OS 설정 스크립트를 두지 않는다. AWS route table, 보안 그룹,
EC2 source/destination check는 Terraform이 관리하고, OS NAT/nftables/UFW/WireGuard/k3s는
Ansible만 관리한다. Ubuntu 이미지 자체의 cloud-init 완료 대기는 기본 부팅과 apt 잠금 충돌을
피하기 위한 것으로, 별도 초기 설정을 cloud-init에 위임하는 것은 아니다.
Terraform apply 직후에는 EC2와 AWS 경로만 있고, Ansible 실행 전에는 신규 gateway의 NAT가 동작하지 않는다.

## VPN 주소와 네트워크

| 대상 | VPN 주소 | 연결 대상 |
| --- | --- | --- |
| SSAFY | 10.200.0.1 | gateway 고정 공인 IP:51820 |
| gateway | 10.200.0.2 | 각 peer가 연결을 시작하면 endpoint 학습 |
| worker-1 | 10.200.0.11 | gateway 사설 IP:51820 |
| worker-2 | 10.200.0.12 | gateway 사설 IP:51820 |

worker에도 WireGuard를 설치해 k3s node-ip와 flannel-iface를 VPN으로 통일한다.
worker 기본 경로와 NAT는 그대로 유지하고 VPN 대역만 wg0로 전달한다.
모든 VPN 인터페이스 MTU는 1380이며 VXLAN이 그 위에서 동작한다.
gateway는 k3s에 가입하지 않는다. VPN 개인 키는 원격 /etc/wireguard에만 영구 저장한다.
Ansible 실행 중 키와 가입 토큰은 메모리에서 사용하되 로그·artifact·Terraform 상태에 저장하지 않는다.

SSAFY UFW는 비활성화하지 않고 wg0/파드 통신 및 80/443 규칙만 추가한다.
SSH 22와 기존 규칙을 유지하며 6443/8472를 공인망에 개방하지 않는다.
gateway의 전용 nftables 규칙은 Ansible이 단독 관리하며 VPN peer 간 전달도 허용한다.
다른 방화벽 관리 도구와 gateway의 nftables 규칙을 동시에 관리하지 않는다.

## GitLab CI

Terraform validate와 함께 `ansible:validate`가 인증 없이 실행된다.
Terraform apply는 기존대로 자동 실행하며 IP output JSON만 artifact로 전달한다.
그 뒤 **ansible:configure가 자동 실행**되어 서버를 구성한다.
기본 브랜치의 infra 변경 또는 기본 브랜치에서 웹으로 시작한 파이프라인이 대상이며,
MR에서는 검증만 실행한다. Ansible 실패 시 파이프라인도 실패한다.
최신 인프라에 대응하는 최신 파이프라인에서 실행한다.

기존 `TFVARS` 및 AWS 인증은 유지하고 다음 접속 정보를 추가한다.

| 변수 | Type | 내용 |
| --- | --- | --- |
| SSAFY_HOST | Variable | 지급받은 공인 도메인 또는 공인 IPv4 |
| SSAFY_SSH_KEY | File | 지급받은 PEM 개인 키 전체 내용 |
| PERSONAL_SSH_KEY | File | gateway/worker에 지정한 PEM 개인 키 전체 내용 |
| SSH_KNOWN_HOSTS | File | 신뢰성을 확인한 네 서버의 SSH host key 레코드 |

PEM과 known_hosts는 여러 줄 File 변수이므로 Visible로 등록하고 **Protected** 설정과
프로젝트 접근 권한으로 관리한다. 개인 키를 Git에 커밋하거나 출력하지 않는다.
여기서 PEM이 필요한 이유는 이 작업이 실제 SSH 접속을 하기 때문이다.
Terraform의 `ssh_key_name`은 키 이름만 필요하지만 Ansible은 개인 키로 접속해야 한다.
File 변수의 끝에 줄바꿈을 포함한다. 키가 암호화되어 있다면 별도 SSH agent 구성이 필요하며
현재 CI는 암호 입력 없는 전용 배포 키를 전제로 한다.
서버 교체 시 host key가 변경되므로 fingerprint를 확인해 known_hosts를 갱신한다.

known_hosts에는 SSAFY 도메인(또는 IP), gateway EIP, 두 worker의 사설 IP에 대한 레코드가 필요하다.
최초 SSH 접속 시 신뢰할 수 있는 경로의 fingerprint와 비교한 뒤 ~/.ssh/known_hosts를 준비한다.
worker는 gateway를 경유해 확인한다. `ssh-keyscan` 결과만으로 신뢰성을 확인했다고 간주하지 않는다.
host key 검사를 비활성화하지 않는다. gateway와 worker에 개인 PEM을 복사할 필요도 없다.
gateway 보안 그룹의 UDP 51820 허용 대상은 SSAFY **공인** IP여야 한다.

## 로컬 실행

```bash
cd infra/ansible
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
export ANSIBLE_CONFIG="$PWD/ansible.cfg"
export SSAFY_HOST=YOUR_SSAFY_HOST
export SSAFY_SSH_KEY=/absolute/path/ssafy.pem
export PERSONAL_SSH_KEY=/absolute/path/personal.pem
chmod 600 "$SSAFY_SSH_KEY" "$PERSONAL_SSH_KEY"
# 기존 Terraform HTTP backend와 AWS 인증이 설정된 환경에서 실행
terraform -chdir=../terraform output -json > ../terraform/terraform-output.json
python scripts/inventory.py --terraform-output ../terraform/terraform-output.json
ansible-playbook site.yml --syntax-check
ansible-playbook site.yml
```

검증만 수행하려면 `python -m unittest discover -s tests` 및
`ansible-playbook -i inventory.example.yml site.yml --syntax-check`를 사용한다.
예시 inventory는 접속 대상이 아니며 실제 실행 시에는 생성된 inventory를 사용한다.
check mode는 신규 설치의 키·토큰 생성과 실제 통신을 검증할 수 없으므로 배포 대신 쓰지 않는다.

## 재실행 및 애플리케이션 배치

기존 WireGuard 키, k3s 데이터 및 server token을 보존한다. 설정이 바뀌면 관련 서비스만 재시작한다.
이전에 user_data로 구성한 gateway도 Ansible이 같은 설정 파일을 이어서 관리한다.
user_data 제거 및 AMI 갱신이 기존 EC2에 미치는 영향은 배포 plan에서 확인한다.
gateway가 교체되면 새 SSH fingerprint를 검증해 SSH_KNOWN_HOSTS를 갱신한 뒤 설정을 재실행한다.
다른 방법으로 설치된 k3s는 덮어쓰지 않고 중단한다. 실패 후 같은 플레이북으로 재시도할 수 있다.
k3s 버전은 group_vars/all.yml에 고정하며, 변경 시 업그레이드 계획과 데이터 백업을 먼저 준비한다.
현재는 신규 클러스터 생성용이며 자동 롤백·클러스터 초기화·제거는 구현하지 않는다.

Traefik과 ServiceLB의 외부 진입점은 SSAFY에 배치한다.
Spring Deployment는 `nodeSelector: {infra.mozzi/role: worker}`와 hostname 기준 anti-affinity로
두 worker에 나누어 배치한다. 이 플레이북은 Spring/Argo CD/모니터링을 배포하지 않는다.
private ECR 이미지 인증도 후속 작업이다. 별도 IAM 또는 imagePullSecret 구성이 필요하다.
실제 실행은 네 서버의 SSH 접속 권한과 sudo, 외부 패키지 다운로드가 가능해야 한다.
