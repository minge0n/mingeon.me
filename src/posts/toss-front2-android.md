---
title: 토스 프론트2에 안드로이드 설치하고 루팅하기
date: 2026-11-05
description: 토스 프론트2를 EDL로 백업하고, AVB 서명 체인을 유지한 채 LineageOS 22.2 GSI와 Magisk를 설치한 기록.
tags: [Android, 토스프론트, LineageOS, Magisk]
draft: false
---

> [!WARNING]
> 본 글은 100% AI로 작성되었습니다.

[전 과정 터미널 명령으로 바로 이동](#전체-터미널-명령-기록)

토스 프론트2를 결제 단말기가 아닌 일반 안드로이드 기기로 써 보고 싶었다. 목표는 LineageOS를 설치하고, Google Play가 포함된 환경에서 앱을 실행하고, Magisk로 루트 권한까지 얻는 것이었다.

작업은 2026년 11월 2일부터 3일까지 진행했다. 결론부터 말하면 **Android 15 기반 LineageOS 22.2 부팅과 Magisk 31.1 루트 권한까지 확인했다.** 다만 부트로더를 언락한 뒤 `fastboot flash`를 실행하는 일반적인 방식은 아니었다.

> [!WARNING]
> 이 글은 내가 가진 프론트2 한 대에서 진행한 작업 기록이다. 다른 세대나 펌웨어에서 그대로 재현된다는 보장은 없다. 분해, 저장장치에 쓰기, 데이터 초기화가 포함되며 기기가 부팅되지 않을 수 있다. 실제 결제에 쓰는 단말기나 타인 소유·임대 기기에는 적용하지 말자. 백업은 만들었지만 전체를 복원하는 시험까지 한 것은 아니다.

## 작업 개요

### OS 교체·루팅·언락

처음에는 이 작업을 모두 묶어서 '루팅'이라고 불렀지만, 실제로는 서로 다른 작업이었다.

- **GSI 설치:** 기존 시스템을 일반 안드로이드 시스템 이미지로 교체한다.
- **Magisk 설치:** 부팅 이미지의 ramdisk를 패치해 루트 권한을 얻는다.
- **부트로더 언락:** 부트로더의 잠금 상태를 바꾼다.

이번에는 앞의 두 가지를 했다. 부트로더 언락은 하지 않았고, 작업 후에도 Android가 보고하는 잠금 상태는 `locked`, Verified Boot 상태는 `green`이었다. 이 값만 보고 순정 상태라거나 보안이 보장된다고 해석해서는 안 된다.

### 환경과 도구

출발점은 제품 펌웨어 **1.609.1**인 토스 프론트2였다. 프론트 1세대나 1.5세대 작업기와는 구분해야 한다.

호스트 운영체제는 macOS였고, 작업에 따라 다음 도구를 사용했다.

- `bkerler/edl`과 기기에 맞는 Firehose 로더: EDL에서 UFS를 읽고 쓰는 데 사용했다.
- AOSP `avbtool`: AVB 이미지, 공개키, 서명과 descriptor를 확인하고 다시 서명하는 데 사용했다.
- ADB: 첫 부팅 후 Android의 상태를 확인하고 기기에서 패치하는 데 사용했다.
- 별도 작성한 스크립트: GPT와 동적 파티션을 분석하고, `super`를 재구성하고, 해시를 검증하는 데 사용했다.
- 공식 Magisk 31.1 APK와 그 안에 포함된 패치 스크립트

아래는 이 도구들로 무엇을 했는지 정리한 기록이다. 기기별 파티션 주소와 로더가 필요한 쓰기 명령을 모든 기기에 적용할 수 있는 설치 명령처럼 제시하지는 않는다.

## 접근과 백업

### EDL 진입

이 펌웨어에서는 예전 작업기에 나온 USB·버튼 방식만으로 EDL에 들어갈 수 있다고 가정하지 않았다. 후면을 열고 보드의 `1V8`과 `BOOT` 접점을 이용하는 방법으로 진행했다.

접점 작업에서는 핀셋 손잡이가 금속인지보다 **양 끝이 지정한 접점에만 닿는지**가 중요했다. 주변 부품, 특히 `12V` 쪽에 닿지 않도록 해야 한다. 보드 사진과 접점 위치가 자기 기기와 다르면 멈추는 것이 맞다.

EDL은 Android가 부팅되지 않아도 저장장치에 접근할 수 있는 경로다. 반대로 잘못 쓰면 Android 쪽 복구 기능과 무관하게 문제가 생길 수 있어서, 처음에는 저장장치에 쓰지 않고 읽어서 백업부터 했다.

### UFS 백업

백업은 GPT로 주소를 확인할 수 있는 UFS LUN 6개를 대상으로 했다. 전체 크기는 **31,977,373,696바이트, 약 29.78GiB**였다.

백업 파일이 생성됐는지 확인하는 데 그치지 않고, 다음 항목도 점검했다.

1. 각 LUN의 실제 크기와 GPT에 기록된 범위가 맞는지
2. primary·backup GPT의 CRC가 맞는지
3. 백업 파일의 SHA-256 해시
4. `vbmeta_a/b`, `vbmeta_system_a/b`, `abl_a/b`, `smraw` 등 중요 파티션 7개를 별도로 다시 읽었을 때의 일치 여부

이 백업에는 일반 주소 공간의 원본 데이터가 들어 있다. 하지만 **RPMB, 퓨즈, 비주소화된 보안 상태까지 백업한 것은 아니다.** 전체를 실제로 복원해 보는 시험도 하지 않았다. '백업이 있으니 무조건 복구된다'고 말할 수는 없다.

## LineageOS 설치

### AVB 키 확인

핵심은 여기였다. 원본 `vbmeta`를 분석했더니 **B 슬롯의 공개키가 AOSP 테스트 키와 일치**했다.

- 최상위 `vbmeta_b`: AOSP `testkey_rsa4096`
- 연결된 `vbmeta_system_b`: AOSP `testkey_rsa2048`

A 슬롯의 키는 각각 이 테스트 키와 일치하지 않았다. 백업에서 본 원본 B 슬롯은 Android 13 빌드 `468`이었고, A 슬롯은 `475`였다. 제품 설정의 펌웨어 버전만 볼 것이 아니라 실제 대상 슬롯과 이미지를 확인해야 했다. 같은 기기 안에서도 슬롯마다 조건이 달랐다.

AVB는 부팅할 이미지의 해시와 서명을 확인하는 구조다. 이미지 내용만 바꾸면 기존 검증 정보와 맞지 않으므로, 수정한 이미지에 맞춰 관련 descriptor와 서명도 일관되게 만들어야 한다.

이번에는 B 슬롯의 키와 일치한 테스트 키로 수정한 이미지와 연결된 `vbmeta`를 다시 서명했다. **검증을 꺼 버리거나 부트로더를 언락하는 방식과는 다르다.**

다만 공개키 일치나 오프라인 서명 검증만으로 실제 기기가 부팅을 허용한다고 단정하지 않았다. 최종적으로는 실제 기기가 부팅되는지와 실행 중인 상태를 따로 확인했다.

### GSI 선택

사용한 파일은 다음 비공식 빌드였다.

```text
lineage-22.2-20251015-UNOFFICIAL-gsi_arm64_gN.img
```

Android 15 기반 LineageOS 22.2 GSI이며, `gN`은 이 빌드의 표기에 따르면 GApps는 포함하고 Superuser는 포함하지 않은 구성이다. Google 앱이 들어 있다는 것과 루팅되어 있다는 것은 별개다.

다운로드한 원본은 3,102,658,560바이트였고, SHA-256은 다음과 같았다.

```text
a81a4eb637df101722ddd3793ff3fd1322f4ac0de4b1b10326eecf8db6f4ff42
```

이 값은 **내가 받은 파일의 식별용 해시**다. 배포자가 별도로 공개한 체크섬과 대조한 것은 아니다. 설치 준비 과정에서 AVB footer를 재서명했으므로 준비된 `system_b` 이미지의 해시는 위 원본 해시와 달라진다.

### `super` 재구성

GSI를 `system`이라는 물리 파티션에 통째로 쓰는 구조가 아니었다. 이 기기는 동적 파티션을 사용하고, 여러 논리 파티션이 **5GiB 크기의 `super`** 안에 들어 있었다. 원본에는 Virtual A/B의 COW 항목도 있었다.

먼저 fastboot 경로를 조사했다. macOS에서 일반 fastboot 통신에 문제가 있었고, libusb를 통한 읽기 전용 조회에서는 `is-userspace=yes`, `current-slot=b`, `unlocked=no`, `snapshot-update-status=none` 등을 확인했다. 하지만 실제 GSI 쓰기는 fastboot가 아니라 **EDL**로 진행했다.

오프라인 재구성에서 한 일은 다음과 같다.

- `system_b`를 준비한 GSI로 교체
- `odm_b`, `product_b`, `system_dlkm_b`, `vendor_b`, `vendor_dlkm_b`의 내용과 물리 매핑 유지
- `system_ext_b`와 `*-cow` 항목·COW group 제거
- `system_b`를 512KiB 시작 정렬 조건에 맞춘 7개 extent에 배치
- B 슬롯에 대응하는 slot-1 논리 파티션 메타데이터의 primary·backup 사본 재작성
- 메타데이터 체크섬, extent 범위·겹침 여부, 논리 파티션 해시 재검증

원래 들어 있던 제조사의 vendor와 드라이버는 보존하고 시스템을 교체한 것이다. `vbmeta_system_b`도 바뀐 시스템과 기존 연결 구조에 맞춰 재서명했다. 이 GSI 설치 단계에서는 최상위 `vbmeta_b`는 유지했다.

> [!WARNING] > `super`는 A/B가 공유한다. A 슬롯의 메타데이터 사본을 보존했다고 해서 원래 A 슬롯 OS로 안전하게 돌아갈 수 있다는 뜻은 아니다. 이번 재구성은 순정 A 슬롯 부팅 가능성을 보장하지 않는다. 또한 COW 항목을 지우는 작업을 일반적인 OTA 문제 해결법처럼 적용하면 안 된다.

### 쓰기와 재읽기

쓰기 직전에는 현재 기기에서 파티션을 다시 읽고, 원본 백업 및 준비한 이미지와 조건이 맞는지 확인했다. 실제 쓰기 순서는 다음과 같았다.

1. 재구성한 `super` 전체, 5GiB
2. 재서명한 `vbmeta_system_b`, 64KiB
3. 이전 OTA 상태를 정리하기 위한 빈 ext4 `metadata`, 64MiB

각 파티션을 쓴 뒤에는 **해당 파티션 전체를 다시 읽어 준비 이미지와 SHA-256이 같은지 확인했다.** 도구가 쓰기에 성공했다고 반환하는 것과 실제로 저장된 바이트가 준비한 이미지와 일치하는 것은 별개이기 때문이다.

이후 `misc`의 첫 4096바이트 안에서 BCB의 필요한 필드만 바꿔 기존 순정 recovery에 `boot-recovery`와 `--wipe_data`를 요청했다. `userdata`를 임의의 원시 이미지로 덮어쓰지는 않았다.

기록으로 확실히 확인할 수 있는 것은 초기화를 요청했다는 사실과 그 뒤에 기기가 처음 부팅됐다는 사실이다. recovery 내부에서 포맷이 어떻게 끝났는지 보여 주는 전체 로그까지 확보한 것은 아니다.

## Magisk 루팅

### 무선 ADB 연결

초기 설정 화면이 나온 뒤 기본 설정을 진행했다. 그런데 Android가 켜진 상태에서는 USB ADB에서 기기가 인식되지 않았다. EDL이나 fastbootd에서 USB 통신이 됐다고 해서 Android의 USB 디버깅까지 되는 것은 아니었다.

대신 무선 디버깅을 켜고 mDNS에서 `_adb-tls-connect._tcp` 서비스를 찾아 연결했다. 이때 다음을 확인했다.

- Android 15 / LineageOS 22.2
- 부팅이 완료됐고 B 슬롯을 사용하고 있다는 사실
- 기본 HOME 런처가 있다는 사실
- Play 스토어와 Google Play 서비스 패키지가 설치돼 있다는 사실

여기서 확인한 것은 **패키지가 설치돼 있다는 사실까지**다. Google 계정 로그인, 스토어에서 앱을 내려받는 동작, Play Protect 기기 인증, Play Integrity 통과까지 한꺼번에 성공했다고 쓰면 안 된다.

무선 ADB도 재부팅 뒤 자동으로 복구되지 않아 무선 디버깅을 다시 켜고 연결해야 했다. 자동으로 재연결된다고 가정하고 작업 순서를 정하지 않는 편이 좋다.

### `init_boot` 패치

원본 부팅 이미지 헤더를 보면 `boot_a/b`의 ramdisk 크기는 0이었고, `init_boot_a/b`에 ramdisk가 들어 있었다. 그래서 현재 B 슬롯의 **init_boot_b**를 Magisk 패치 대상으로 삼았다.

여기서 먼저 루트 권한을 어떻게 얻었는지 설명할 필요가 있다. 설치한 GSI는 `userdebug` 빌드였고 `ro.debuggable=1`이었다. 무선 연결에서 `adb root`를 실행하자 `restarting adbd as root`가 반환됐고, 재연결 후 root shell을 확인했다. 임시로 루트 권한을 얻은 이 방법과 나중에 일반 shell에서 확인한 Magisk `su`는 별개다.

공식 Magisk 31.1 APK에서 패치 도구를 추출해 해당 기기에 옮기고, 원본 `init_boot_b`를 기기 안에서 공식 `boot_patch.sh`로 패치했다. 결과 이미지를 호스트로 가져와 AVB 서명을 구성했다. 이때 검증·암호화 관련 설정은 다음처럼 유지했다.

```text
KEEPVERITY=true
KEEPFORCEENCRYPT=true
PATCHVBMETAFLAG=false
```

여기서 끝내면 안 됐다. `init_boot_b`가 바뀌면 최상위 `vbmeta_b`에 있는 해당 이미지의 해시 descriptor도 바뀌어야 했다. 따라서 패치한 이미지와 맞는 descriptor를 만들고, 기존 B 슬롯 키로 `vbmeta_b`를 다시 서명했다.

Magisk 단계의 펌웨어 변경 대상은 **`init_boot_b`와 `vbmeta_b`의 한 쌍**이었다. 기존 키와 rollback index, 검증 flag, 나머지 descriptor는 유지했다. 두 이미지를 적용하고 물리 파티션 해시를 확인한 뒤 재부팅했다.

> [!WARNING]
> 이 구성에서 Magisk의 일반적인 Direct Install·업데이트·제거를 그대로 실행하면 서명 쌍이 깨질 수 있다. `init_boot_b`만 바꾸거나 복원하지 말고, 대응하는 `vbmeta_b`까지 검증된 쌍으로 다뤄야 한다. 다른 사람의 패치 이미지를 가져다 쓰는 것도 피해야 한다.

### 재부팅 후 검증

Magisk 앱을 설치했다는 것만으로 루팅이 끝난 것은 아니다. 실제 재부팅 이후 일반 ADB shell에서 `su`를 호출해 루트 권한을 얻는지 확인했다.

조회에는 다음과 같은 명령을 사용했다. 아래는 같은 조회를 재현할 수 있도록 대상 주소를 변수로 뺀 예시다. `ADB_TARGET`에는 실제 대상 기기의 무선 ADB 주소를 넣어야 한다.

```sh
ADB_TARGET='대상 기기의 IP:포트'
adb -s "$ADB_TARGET" shell getprop sys.boot_completed
adb -s "$ADB_TARGET" shell getprop ro.boot.slot_suffix
adb -s "$ADB_TARGET" shell getprop ro.boot.flash.locked
adb -s "$ADB_TARGET" shell getprop ro.boot.verifiedbootstate
adb -s "$ADB_TARGET" shell su -c id
```

작업 당시 최종 확인값은 다음과 같았다. 위 명령을 지금 새로 실행한 결과가 아니라 **2026년 11월 3일 검증 기록**이다.

```text
sys.boot_completed = 1
ro.boot.slot_suffix = _b
ro.boot.flash.locked = 1
ro.boot.verifiedbootstate = green
Magisk = 31.1:MAGISK:R / 31100
su = uid=0(root) gid=0(root) groups=0(root) context=u:r:magisk:s0
```

재부팅 후 `init_boot_b`와 `vbmeta_b`의 물리 해시도 준비한 서명 쌍과 일치했다.

![작업 당시 Magisk 31.1이 설치된 토스 프론트2 화면](/toss-front2-android/magisk.png)

루트 권한을 얻은 뒤에는 화면을 계속 켜 두는 wake lock 서비스도 추가했다. 재부팅 후 서비스가 자동 실행되는 것과 짧은 화면 꺼짐 시간을 설정한 뒤에도 화면이 켜져 있는 것을 확인했다.

## 제약과 주의점

설치가 됐다고 모든 기능 검증이 끝난 것은 아니다.

- Google 로그인·스토어 다운로드·기기 인증·Play Integrity는 각각 별도 확인이 필요하다.
- 카메라, 오디오, 네트워크와 결제용 주변 하드웨어의 정상 동작도 따로 봐야 한다.
- 일반 안드로이드 앱에서 결제용 하드웨어를 바로 사용할 수 있다고 가정하면 안 된다.
- 순정 OTA나 일반 Magisk 업데이트를 그대로 적용할 수 있는 구성이라고 보장하지 않는다.
- 무선 디버깅이 재부팅 뒤 자동으로 돌아오지는 않았다.
- 작업 중 GSI에서 `ro.adb.secure=0`이 확인됐다. 디버깅 포트를 외부에 노출하지 않고, 필요할 때만 신뢰할 수 있는 네트워크에서 사용하는 편이 안전하다.
- 원본 백업이 있어도 전체 복원과 보안 상태 복구는 검증하지 못했다.

이번 작업의 핵심은 '잠금을 풀고 아무 이미지나 올리기'가 아니었다. **원본을 백업하고, 실제 B 슬롯의 서명 구조를 확인한 뒤, 그 구조와 맞는 시스템 이미지와 부팅 이미지의 조합을 만들어 검증한 것**이었다.

일반 안드로이드 부팅과 재부팅 후 루트까지는 확인했다. 이후에는 이 기기를 대시보드처럼 활용하는 쪽을 별도로 다뤄 볼 생각이다.

## 전체 터미널 명령 기록

앞에서는 과정을 설명했고, 여기서는 각 단계에서 쓴 명령을 모았다. 경로와 기기 주소는 변수로 바꿨고, Node.js에서 `spawnSync`로 호출했던 명령은 같은 인자를 사용하는 셸 명령으로 풀어 썼다. 이 문서를 쓰면서 기기에 다시 실행한 것은 아니다.

**아래를 위에서부터 한 번에 실행하는 설치 스크립트가 아니다.** '실행 진입점'과 '스크립트 내부 호출'은 같은 작업을 서로 다른 수준에서 보여 준 것이므로 중복 실행하면 안 된다. 특히 쓰기·초기화·재부팅 블록은 내 기기에서 통과한 사전 검사와 승인 상태를 전제로 한다.

[사용한 자체 스크립트와 명령 원문 내려받기](/toss-front2-android/procedure-sources.zip)

첨부 파일은 설치 프로그램이 아니라 기록용 소스다. 개인 경로, 주소와 장치 식별자는 바꿨고, 기기 백업·펌웨어·키 파일·승인 상태 파일은 포함하지 않았다. 따라서 압축만 풀어서는 실행할 수 없다. 자체 도구가 참조하는 GPT manifest, 이전 해시, 현재 슬롯과 승인 상태를 자기 기기에 맞게 다시 확인해야 한다.

### 도구 준비와 백업

#### A. 공통 경로와 당시 도구 버전

```sh
export ROOT="/path/to/toss-front2"
export B="$ROOT/backups/20261102-193800-stock"
export D="$ROOT/images/prepared-gsi"
export EDL="$ROOT/edl/.venv312/bin/edl"
export AVB="$ROOT/tools/avb/avbtool.py"
export ADB="$HOME/Library/Android/sdk/platform-tools/adb"
export KEY2048="$ROOT/tools/avb/test/data/testkey_rsa2048.pem"
export KEY4096="$ROOT/tools/avb/test/data/testkey_rsa4096.pem"
export ADB_TARGET='대상 기기의 현재 IP:포트'
cd "$ROOT"

avb() {
  "$ROOT/edl/.venv312/bin/python" "$AVB" "$@"
}
```

기록에 남은 버전은 Python 3.12.8, EDL commit `1cda1a616748d608667b2d13b73a28d3197ceb45`, AVB commit `ba2dec4b035b0a3b61c5f8f8a74d86bcd450b1ee`였다. `avbtool info_image --output_pubkey`도 이 체크아웃에서 지원됐다. 다른 버전에서도 옵션이 같다고 가정하지 말자.

Python 3.9 환경의 의존성 설치는 실패했다. 다음은 당시 3.12 환경으로 바꾸도록 안내했던 준비 명령이다. **이 블록의 각 설치 명령이 성공했다는 터미널 출력은 확보하지 못했고**, 이후 `.venv312/bin/edl`이 실제 읽기에 성공한 사실을 확인했다.

```sh
cd "$ROOT/edl"
/path/to/python3.12 -m venv .venv312
source .venv312/bin/activate
python --version
python -m pip install --upgrade pip setuptools wheel
python -m pip install .
edl -h
cd "$ROOT"
```

AVB 도구는 당시 공식 소스의 다음 브랜치로 확보했다. 위에서 기록한 commit은 실제 체크아웃 결과다.

```sh
mkdir -p tools
if [ ! -d tools/avb ]; then
  git clone --depth 1 --branch android17-release \
    https://android.googlesource.com/platform/external/avb tools/avb
fi
git -C tools/avb rev-parse HEAD
avb version
avb info_image --help
```

`firehose.elf`와 GSI는 별도로 확보했다. GSI는 브라우저에서 내려받았으므로 당시 사용하지 않았던 `curl` 다운로드 명령을 여기에 만들어 넣지는 않았다.

#### B. EDL 인식과 GPT 읽기

접점 작업은 물리적인 절차라 터미널 명령이 없다. EDL로 들어간 뒤 Mac의 USB 목록과 GPT를 읽었다.

```sh
/usr/sbin/ioreg -p IOUSB -l -w 0
mkdir -p logs
LOG="logs/gpt-$(date +%Y%m%d-%H%M%S).txt"
"$EDL" printgpt --memory=ufs --loader="$ROOT/firehose.elf" \
  2>&1 | tee "$LOG"
```

여러 기기가 연결돼 있으면 USB에서 먼저 대상 기기를 식별해야 한다. 이 프로젝트의 쓰기 도구는 대상 EDL 기기가 정확히 한 대인지도 검사했다.

#### C. UFS 전체 백업과 독립 재읽기

전체 읽기는 `rf`였다. 결과 파일은 `ufs.bin.lun0`처럼 LUN별로 생겼다.

```sh
mkdir -p "$B/raw" "$B/logs" "$B/verification" "$B/partitions" "$B/analysis"
cp "$LOG" "$B/logs/initial-gpt.txt"
RC=0
"$EDL" rf "$B/raw/ufs.bin" \
  --memory=ufs --loader="$ROOT/firehose.elf" \
  > "$B/logs/full-read.log" 2>&1 || RC=$?
printf '%s\n' "$RC" > "$B/logs/full-read.exit-code"
[ "$RC" -eq 0 ] || { echo '원시 백업 실패. 여기서 중단'; exit 1; }
```

위 블록은 당시 전체 읽기 wrapper에서 사용한 경로와 호출을 정리해 같은 기능을 하는 셸 명령으로 표현한 것이다. 원문은 첨부 `recorded-commands/00-backup-start.sh`에 있다. **전체 읽기가 끝나 종료 코드 0을 기록하기 전에는 두 번째 USB 명령을 시작하지 않는다.**

검증기가 참조할 AOSP 공개키 파일도 미리 준비했다. 이 작업은 호스트 파일만 다룬다.

```sh
mkdir -p "$B/analysis/aosp-public-keys"
for name in testkey_rsa2048 testkey_rsa2048_2 testkey_rsa4096 testkey_rsa8192; do
  avb extract_public_key --key "$ROOT/tools/avb/test/data/$name.pem" \
    --output "$B/analysis/aosp-public-keys/$name.avbpubkey" || exit 1
done
```

그다음 중요 파티션을 별도로 다시 읽었다. 다음 `r`은 읽기 명령이다.

```sh
PARTS=vbmeta_a,vbmeta_b,vbmeta_system_a,vbmeta_system_b,abl_a,abl_b,smraw
FILES="$B/verification/vbmeta_a.img,$B/verification/vbmeta_b.img,$B/verification/vbmeta_system_a.img,$B/verification/vbmeta_system_b.img,$B/verification/abl_a.img,$B/verification/abl_b.img,$B/verification/smraw.img"
[ "$(cat "$B/logs/full-read.exit-code")" = 0 ] || exit 1
RC=0
"$EDL" r "$PARTS" "$FILES" \
  --memory=ufs --loader="$ROOT/firehose.elf" \
  > "$B/logs/independent-reread.log" 2>&1 || RC=$?
printf '%s\n' "$RC" > "$B/logs/reread.exit-code"
[ "$RC" -eq 0 ] || { echo '독립 재읽기 실패. 여기서 중단'; exit 1; }

node tools/verify-stock-backup.mjs "$B" \
  2>&1 | tee "$B/logs/verification.log"
```

`node`는 당시 사용한 Node 실행 파일의 절대 경로를 줄여 쓴 것이다. 중복 검증을 막는 lock과 종료 코드를 확인하는 gate까지 포함한 원래 완료 wrapper는 첨부의 `tools/complete-stock-backup.sh`에 있다.

`verify-stock-backup.mjs`는 별도로 만든 도구다. LUN 크기, 양쪽 GPT CRC, 파티션 추출, SHA-256 및 재읽기 일치를 확인했다. 이 과정의 AVB 검증 결과는 백업한 바이트의 일치 여부와 구분해서 읽어야 한다.

#### D. 기기 공개키와 AOSP 테스트 공개키 비교

단순히 '키가 같다'고 적는 대신, 확인 명령과 값을 남겨 둔다. 먼저 백업 이미지에서 AVB 형식의 공개키를 추출했다.

```sh
mkdir -p "$B/analysis/key-check"
K="$B/analysis/key-check"

for part in vbmeta_a vbmeta_b vbmeta_system_a vbmeta_system_b; do
  avb info_image \
    --image "$B/partitions/$part.img" \
    --output_pubkey "$K/$part.avbpubkey" \
    > "$K/$part-info.txt"
done

avb extract_public_key --key "$KEY4096" \
  --output "$K/testkey_rsa4096.avbpubkey"
avb extract_public_key --key "$KEY2048" \
  --output "$K/testkey_rsa2048.avbpubkey"

cmp "$K/vbmeta_b.avbpubkey" "$K/testkey_rsa4096.avbpubkey"
cmp "$K/vbmeta_system_b.avbpubkey" "$K/testkey_rsa2048.avbpubkey"
shasum -a 1 "$K/"*.avbpubkey
```

실제 비교는 검증 스크립트에서도 바이트 단위로 수행했다. 위 `cmp`는 같은 비교를 읽기 쉽게 풀어 쓴 것이다.

`cmp`는 일치하면 아무것도 출력하지 않고 종료 코드 0을 반환한다. 기록된 공개키의 SHA-1은 다음과 같았다. SHA-1은 여기서 `avbtool` 표시에 맞춘 식별용이고, 실제 비교는 공개키 전체 바이트가 같은지를 본 것이다.

```text
vbmeta_b         / testkey_rsa4096
2597c218aae470a130f61162feaae70afd97f011

vbmeta_system_b  / testkey_rsa2048
cdbb77177f731920bbe0a0f94f84d9038ae0617d

vbmeta_a
 a463d01bfb41180cb3299b64f1cff717ef50f056
vbmeta_system_a
 8ab080aadea9a410c4528dde1e31394e2ae8b348
```

A 슬롯의 두 키는 위에서 비교한 AOSP 테스트 키와 일치하지 않았다. 여기서 '같다'는 것은 **B 슬롯에서 추출한 AVB 공개키와 테스트 키로부터 만든 공개키가 같다**는 뜻이다. 기기에서 개인키를 추출했다는 뜻은 아니다.

### GSI 제작과 설치

#### E. 원본 `super` 분석과 전체 AVB 체인 준비

```sh
node tools/inspect-super.mjs
node tools/extract-stock-logical.mjs

avb verify_image \
  --image "$B/analysis/stock-b-chain/vbmeta.img" \
  --key "$KEY4096" \
  --follow_chain_partitions \
  > "$B/analysis/stock-b-chain/verify.txt" 2>&1
cat "$B/analysis/stock-b-chain/verify.txt"
```

**바로 위 재귀 검증 명령은 당시 실패한 시도다.** 최상위 RSA4096 `--key`가 하위 RSA2048 이미지에도 적용돼 `Embedded public key does not match given key`가 발생했다. 이후 성공한 F 단계에서는 하위 키를 `--expected_chain_partition`으로 명시하고 체인을 따라 검증했다. 키 일치나 최상위 서명 성공 한 줄만으로 이 실패를 성공으로 읽으면 안 된다.

앞의 두 명령은 자체 도구다. 원시 백업의 extent를 따라 B 논리 파티션을 추출하고, AVB가 찾는 `system.img`, `product.img`, `vendor.img` 등의 파일명으로 검증에 사용할 링크를 준비했다. 키 비교만 끝낸 시점에는 논리 파티션 payload가 없어 전체 descriptor 검증이 실패했으므로, 그 출력을 '전체 체인 검증 성공'으로 취급하지 않았다.

#### F. GSI 해시 확인과 `system` footer 재서명

```sh
GSI="$ROOT/images/lineage-22.2-20251015-UNOFFICIAL-gsi_arm64_gN.img"
shasum -a 256 "$GSI"
mkdir -p "$D"

avb make_vbmeta_image \
  --output "$D/system-footer.vbmeta" \
  --algorithm SHA256_RSA2048 --key "$KEY2048" \
  --rollback_index 0 --rollback_index_location 0 \
  --include_descriptors_from_image "$GSI"
```

그다음 기존 filesystem과 hashtree는 변경하지 않고, 원본 footer가 가리키는 vbmeta 영역만 새 서명으로 바꿨다. 아래는 당시 실행한 Node 코드에서 경로만 변수화한 것이다. **호스트의 새 파일만 만들고 기기에는 쓰지 않는다.**

```sh
export GSI PREP_DIR="$D"
node --input-type=module <<'JS'
import fs from 'node:fs';
const src = process.env.GSI;
const d = process.env.PREP_DIR;
const dest = d + '/system_b.img';
const size = fs.statSync(src).size;
const tail = Buffer.alloc(64);
const fd = fs.openSync(src, 'r');
fs.readSync(fd, tail, 0, 64, size - 64);
fs.closeSync(fd);
if (tail.subarray(0, 4).toString() !== 'AVBf') throw Error('Footer magic');
const offset = Number(tail.readBigUInt64BE(20));
const oldSize = Number(tail.readBigUInt64BE(28));
const meta = fs.readFileSync(d + '/system-footer.vbmeta');
if (offset + meta.length > size - 64 || meta.length > oldSize) {
  throw Error('New vbmeta does not fit');
}
fs.copyFileSync(src, dest, fs.constants.COPYFILE_EXCL | fs.constants.COPYFILE_FICLONE);
const out = fs.openSync(dest, 'r+');
fs.writeSync(out, Buffer.alloc(oldSize), 0, oldSize, offset);
fs.writeSync(out, meta, 0, meta.length, offset);
tail.writeBigUInt64BE(BigInt(meta.length), 28);
fs.writeSync(out, tail, 0, 64, size - 64);
fs.fsyncSync(out);
fs.closeSync(out);
JS

avb make_vbmeta_image \
  --output "$D/vbmeta_system_b.img" --padding_size 65536 \
  --algorithm SHA256_RSA2048 --key "$KEY2048" \
  --rollback_index 1709251200 --rollback_index_location 0 \
  --include_descriptors_from_image "$D/system_b.img" \
  --include_descriptors_from_image "$B/analysis/logical-slot-b/product_b.img"

avb extract_public_key --key "$KEY2048" \
  --output "$D/prepared-system.avbpubkey"
cmp "$D/prepared-system.avbpubkey" \
  "$B/analysis/avb/vbmeta_system_b.avbpubkey"
```

`1709251200`은 이때 본 원본 `vbmeta_system_b`의 rollback index다. 다른 기기에 복사할 기본값이 아니다.

검증 디렉터리에는 원본 B 슬롯의 부팅 이미지, 유지할 논리 이미지와 새 `system.img`, `vbmeta_system.img`의 링크를 준비했다. 그 링크 준비와 결과 manifest 생성까지 포함한 전체 원문은 첨부의 `recorded-commands/01-prepare-gsi.sh`에 있다.

```sh
V="$B/analysis/prepared-chain"
avb verify_image --image "$V/vbmeta.img" \
  --expected_chain_partition "vbmeta_system:2:$B/analysis/avb/vbmeta_system_b.avbpubkey" \
  --follow_chain_partitions
avb verify_image --image "$V/system.img" --key "$KEY2048"
```

#### G. `super` 재구성과 초기화용 `metadata` 준비

`super`는 표준 `lpmake` 한 줄로 만든 것이 아니라, 기존 물리 매핑과 바뀌지 않는 바이트까지 확인하는 자체 builder로 재구성했다.

```sh
node --check analysis/super-builder/build-super-checked.mjs
node analysis/super-builder/build-super-checked.mjs \
  > analysis/super-builder/build-512k-aligned.log 2>&1
cat analysis/super-builder/build-512k-aligned.log
```

이 도구는 준비된 `system-ready.json`, 원본 GPT manifest와 논리 이미지 추출 결과를 입력으로 사용했다. 이미 출력 파일이 있으면 덮어쓰지 않고 중단한다. 단순히 파일명을 바꿔 재실행하는 도구가 아니다.

초기화에 사용할 64MiB ext4 파일은 **Mac의 로컬 이미지 파일**에 만들었다.

```sh
export PREP_DIR="$D"
node --input-type=module <<'JS'
import fs from 'node:fs';
const fd = fs.openSync(process.env.PREP_DIR + '/metadata-clean.img', 'wx', 0o600);
fs.ftruncateSync(fd, 67108864);
fs.closeSync(fd);
JS

SDK_TOOLS="$HOME/Library/Android/sdk/platform-tools"
MKE2FS_CONFIG="$SDK_TOOLS/mke2fs.conf" \
  "$SDK_TOOLS/mke2fs" -q -F -t ext4 -b 4096 -I 512 -m 0 \
  -E lazy_itable_init=0,lazy_journal_init=0 \
  "$D/metadata-clean.img" 16384

node analysis/init-offline/ext4_read.mjs list "$D/metadata-clean.img" /
```

실제로는 root directory에 예전 스냅샷 파일이 없는지 확인하고 ext4 feature와 inode 크기도 검사해 `metadata-ready.json`에 기록했다. 그 검사를 포함한 전체 호출은 첨부의 `recorded-commands/02-prepare-metadata.sh`에 있다.

#### H. 사전 검사, EDL 쓰기와 전체 readback

> [!WARNING]
> 여기부터는 실제 펌웨어 쓰기와 데이터 초기화 요청이다. 다음은 당시 실행 기록이며, 위에서 준비한 파일·원본 해시·GPT·현재 슬롯이 모두 같은 조건에서만 통과했다. 원시 `w`·`ws` 명령만 떼어 실행하지 말자.

자체 도구의 실행 진입점은 다음이었다.

```sh
node tools/preflight-gsi.mjs
node tools/apply-approved-gsi.mjs --commit-approved-gsi
```

`preflight-gsi.mjs` 뒤에는 현재 슬롯 B와 분석한 A/B ABL의 일치 여부를 추가 확인해 상태 기록에 넣었다. 따라서 이 두 줄만 독립적으로 실행하면, 그 상태 파일이 없어 중단되는 것이 정상이다. 내부에서 사용하는 주요 EDL 호출은 다음 순서였다. **아래는 위 명령의 내부 호출을 풀어 쓴 기록이지, 추가로 실행할 다음 단계가 아니다.**

```sh
"$EDL" w super "$D/super.img" --loader="$ROOT/firehose.elf" --memory=ufs --lun=0
"$EDL" r super "$ROOT/analysis/apply-gsi/application/super-readback.img" \
  --loader="$ROOT/firehose.elf" --memory=ufs --lun=0

"$EDL" w vbmeta_system_b "$D/vbmeta_system_b.img" \
  --loader="$ROOT/firehose.elf" --memory=ufs --lun=0
"$EDL" r vbmeta_system_b "$ROOT/analysis/apply-gsi/application/vbmeta_system_b-readback.img" \
  --loader="$ROOT/firehose.elf" --memory=ufs --lun=0

"$EDL" w metadata "$D/metadata-clean.img" --loader="$ROOT/firehose.elf" --memory=ufs --lun=0
"$EDL" r metadata "$ROOT/analysis/apply-gsi/application/metadata-readback.img" \
  --loader="$ROOT/firehose.elf" --memory=ufs --lun=0
```

각 `r` 직후 도구가 전체 파일의 SHA-256을 준비 이미지와 비교했다. 나중에 로그를 다시 확인할 때는 다음 파일을 읽으면 된다.

```sh
cat analysis/install-plan/apply-console.log
cat analysis/apply-gsi/application/result.json
```

#### I. `misc` BCB 초기화 요청과 recovery 재부팅

`misc` 전체를 0으로 지우지 않았다. 원본 1MiB를 읽고 첫 4096바이트의 `command[32]`와 `recovery[768]` 필드만 바꿨다. recovery 인자는 다음이었다.

```text
recovery
--wipe_data
--reason=gsi_install
--locale=en_US
```

이 부분도 `apply-approved-gsi.mjs` 내부에서 실행됐다. `MISC_START_SECTOR`는 고정 숫자를 복사한 것이 아니라 검증한 GPT manifest의 `misc.offsetBytes / 4096`이었다.

```sh
# 내부 호출 기록: 변수는 도구가 검증한 GPT와 생성 파일에서 가져온다.
"$EDL" ws "$MISC_START_SECTOR" "$BCB_FIRST_SECTOR_FILE" \
  --loader="$ROOT/firehose.elf" --memory=ufs --lun=0
"$EDL" r misc "$ROOT/analysis/apply-gsi/application/misc-readback.img" \
  --loader="$ROOT/firehose.elf" --memory=ufs --lun=0
```

`misc` 전체를 다시 읽은 결과가 예상 이미지와 일치하고 네 쓰기 대상이 모두 검증된 다음, 별도 상태 검사 wrapper에서 아래 reset을 호출했다.

```sh
"$EDL" reset --resetmode=reset --loader="$ROOT/firehose.elf"
```

검증과 reset 상태 기록을 포함한 원문은 첨부의 `recorded-commands/03-recovery-reset.sh`에 있다. 이 명령으로 요청한 초기화와 실제 recovery 내부 포맷 완료 로그를 혼동하지 않도록 앞서 적은 한계도 남겨 둔다.

### Magisk 설치와 확인

#### J. 첫 부팅, 무선 ADB와 임시 root ADB

기기 화면에서 초기 설정을 마치고 무선 디버깅을 켠 뒤, 발견된 **현재** 주소로 연결했다.

```sh
"$ADB" mdns services
"$ADB" connect "$ADB_TARGET"
"$ADB" devices -l
"$ADB" -s "$ADB_TARGET" shell id
"$ADB" -s "$ADB_TARGET" shell getprop ro.build.version.release
"$ADB" -s "$ADB_TARGET" shell getprop ro.lineage.version
"$ADB" -s "$ADB_TARGET" shell getprop sys.boot_completed
"$ADB" -s "$ADB_TARGET" shell getprop ro.boot.slot_suffix
"$ADB" -s "$ADB_TARGET" shell pm list packages com.android.vending
"$ADB" -s "$ADB_TARGET" shell pm list packages com.google.android.gms

"$ADB" -s "$ADB_TARGET" root
```

`root` 요청에는 `restarting adbd as root`가 반환됐다. adbd가 다시 시작되면서 포트가 바뀌어 첫 자동 재연결은 실패했다. 따라서 **이전 주소로 계속 명령을 보내지 않고** mDNS에서 새 주소를 찾아 다시 연결했다.

```sh
"$ADB" mdns services
export ADB_TARGET='새로 발견한 대상 기기의 IP:포트'
"$ADB" connect "$ADB_TARGET"
"$ADB" -s "$ADB_TARGET" shell id
```

이때 `uid=0(root)`를 확인했다. 이 단계는 GSI의 userdebug root ADB이며, 아직 Magisk의 일반 shell → `su` 검증이 아니다.

#### K. Magisk 도구 준비, 현재 이미지 재백업과 기기 내 패치

```sh
M="$ROOT/analysis/magisk-install"
mkdir -p "$M/apk" "$M/stage"
unzip -q -o images/Magisk-v31.1.apk \
  'assets/*' 'lib/arm64-v8a/*' -d "$M/apk"

for name in boot_patch.sh util_functions.sh app_functions.sh addon.d.sh module_installer.sh; do
  cp "$M/apk/assets/$name" "$M/stage/$name"
done
for name in magisk magiskinit magiskboot busybox magiskpolicy bootctl init-ld; do
  cp "$M/apk/lib/arm64-v8a/lib$name.so" "$M/stage/$name"
done
cp analysis/apply-gsi/preflight/init_boot_b.img "$M/stage/init_boot_b.original.img"
cp analysis/apply-gsi/preflight/vbmeta_b.img "$M/stage/vbmeta_b.original.img"

"$ADB" -s "$ADB_TARGET" shell mkdir -p /data/local/tmp/aside-magisk
"$ADB" -s "$ADB_TARGET" push "$M/stage/." /data/local/tmp/aside-magisk/
"$ADB" -s "$ADB_TARGET" shell 'readlink -f /dev/block/by-name/init_boot_b; readlink -f /dev/block/by-name/vbmeta_b'
"$ADB" -s "$ADB_TARGET" shell 'blockdev --getsize64 /dev/block/by-name/init_boot_b; blockdev --getsize64 /dev/block/by-name/vbmeta_b'

"$ADB" -s "$ADB_TARGET" shell dd if=/dev/block/by-name/init_boot_b \
  of=/data/local/tmp/aside-magisk/current-init_boot_b.img bs=4096 count=2048
"$ADB" -s "$ADB_TARGET" shell dd if=/dev/block/by-name/vbmeta_b \
  of=/data/local/tmp/aside-magisk/current-vbmeta_b.img bs=4096 count=16
"$ADB" -s "$ADB_TARGET" pull /data/local/tmp/aside-magisk/current-init_boot_b.img "$M/current-init_boot_b.img"
"$ADB" -s "$ADB_TARGET" pull /data/local/tmp/aside-magisk/current-vbmeta_b.img "$M/current-vbmeta_b.img"
cmp "$M/current-init_boot_b.img" analysis/apply-gsi/preflight/init_boot_b.img
cmp "$M/current-vbmeta_b.img" analysis/apply-gsi/preflight/vbmeta_b.img

"$ADB" -s "$ADB_TARGET" install -r images/Magisk-v31.1.apk
"$ADB" -s "$ADB_TARGET" shell 'cd /data/local/tmp/aside-magisk && chmod 755 magisk magiskinit magiskboot busybox magiskpolicy bootctl init-ld && BOOTMODE=true KEEPVERITY=true KEEPFORCEENCRYPT=true PATCHVBMETAFLAG=false RECOVERYMODE=false sh ./boot_patch.sh init_boot_b.original.img'
"$ADB" -s "$ADB_TARGET" pull /data/local/tmp/aside-magisk/new-boot.img \
  "$M/magisk-patched-init_boot_b.img"
```

위 두 `dd`는 block device에서 임시 파일로 **읽는** 명령이다. `if`와 `of`를 뒤집으면 안 된다. 크기 8388608바이트와 65536바이트도 이 기기에서 확인한 값이다.

#### L. `init_boot_b`와 `vbmeta_b` 서명 쌍 만들기

실행 진입점은 다음 자체 스크립트였다. 이 단계는 호스트 파일만 변경하고 기기에는 쓰지 않는다.

```sh
node analysis/magisk-install/build-signed-pair.mjs
cat analysis/magisk-install/signed-pair-report.json
```

내부에서는 패치된 8MiB 전체에 그대로 footer를 붙이지 않고, boot header에서 유효 payload 길이를 계산해 `init_boot.img`를 만든 뒤 처리했다. 첨부 소스에는 그 경계·header 검사도 포함돼 있다. 주요 `avbtool` 호출은 다음과 같았다.

```sh
W="$M/signed-chain"
avb add_hash_footer --image "$W/init_boot.img" \
  --partition_name init_boot --partition_size 8388608 \
  --hash_algorithm sha256 \
  --salt 9500765510a6886225b9d1fe92d21f258763ea765fa7d106305507cfdeb54d1f \
  --algorithm NONE --rollback_index 0 --rollback_index_location 0 --flags 0 \
  --internal_release_string 'avbtool 1.2.0' \
  --output_vbmeta_image "$M/init_boot-hash-only.vbmeta"

avb add_hash_footer --image "$W/init_boot.img" \
  --partition_name init_boot --partition_size 8388608 \
  --hash_algorithm sha256 \
  --salt 9500765510a6886225b9d1fe92d21f258763ea765fa7d106305507cfdeb54d1f \
  --algorithm NONE --rollback_index 0 --rollback_index_location 0 --flags 0 \
  --internal_release_string 'avbtool 1.2.0' \
  --prop 'com.android.build.init_boot.os_version:13' \
  --prop 'com.android.build.init_boot.fingerprint:TOSSPLACE/toss_front2/toss_front2:13/TKQ1.230110.001/468:user/dev-keys' \
  --prop 'com.android.build.init_boot.security_patch:2023-02-05'

avb make_vbmeta_image --output "$W/vbmeta.img" \
  --algorithm SHA256_RSA4096 --key "$KEY4096" \
  --rollback_index 0 --rollback_index_location 0 --flags 0 \
  --internal_release_string 'avbtool 1.2.0' --padding_size 65536 \
  --include_descriptors_from_image "$M/current-vbmeta_b.img" \
  --include_descriptors_from_image "$M/init_boot-hash-only.vbmeta"

avb verify_image --image "$W/init_boot.img"
avb verify_image --image "$W/vbmeta.img" --key "$KEY4096" \
  --expected_chain_partition "vbmeta_system:2:$B/analysis/avb/vbmeta_system_b.avbpubkey"
avb verify_image --image "$W/vbmeta.img" \
  --expected_chain_partition "vbmeta_system:2:$B/analysis/avb/vbmeta_system_b.avbpubkey" \
  --follow_chain_partitions
```

`--algorithm NONE`은 여기서 `init_boot` footer 자체에 별도 RSA 서명을 넣지 않는다는 뜻이다. 바뀐 hash descriptor는 RSA4096으로 서명한 최상위 `vbmeta_b`에서 검증한다. 전체 AVB 검증을 끈 것과 다르다. salt·property·rollback 값은 원본 보존을 위해 사용한 이 기기 값이다.

#### M. 서명 쌍 적용과 재부팅

> [!WARNING]
> 다음은 두 부팅 파티션에 쓰는 단계다. 실제 작업에서는 원본·후보 파일과 물리 파티션 해시, B 슬롯, block mapping, 크기·쓰기 가능 여부를 모두 확인한 뒤 진행했다. 두 이미지 중 하나만 쓰고 재부팅하면 안 된다.

Manager APK 설치만으로는 충분하지 않았다. 서명 쌍 적용 전에 공식 스크립트로 runtime 환경을 준비하고, 기기 안에 원본 두 이미지를 별도로 보관했다. 특히 `/data/adb/aside-magisk-backup`은 이후 로그·상태 파일을 쓰는 데 필요하다.

```sh
mkdir -p "$M/runtime-env"
for name in boot_patch.sh util_functions.sh app_functions.sh addon.d.sh module_installer.sh magisk magiskinit magiskboot busybox magiskpolicy bootctl init-ld; do
  cp "$M/stage/$name" "$M/runtime-env/$name"
done
"$ADB" -s "$ADB_TARGET" shell mkdir -p /data/local/tmp/aside-magisk-runtime /data/adb/aside-magisk-backup
"$ADB" -s "$ADB_TARGET" push "$M/runtime-env/." /data/local/tmp/aside-magisk-runtime/
"$ADB" -s "$ADB_TARGET" push "$M/current-init_boot_b.img" /data/adb/aside-magisk-backup/init_boot_b.original.img
"$ADB" -s "$ADB_TARGET" push "$M/current-vbmeta_b.img" /data/adb/aside-magisk-backup/vbmeta_b.original.img
"$ADB" -s "$ADB_TARGET" shell 'BOOTMODE=true; . /data/local/tmp/aside-magisk-runtime/util_functions.sh; . /data/local/tmp/aside-magisk-runtime/app_functions.sh; fix_env /data/local/tmp/aside-magisk-runtime; chmod 700 /data/adb/aside-magisk-backup; chmod 600 /data/adb/aside-magisk-backup/*.img; /data/adb/magisk/magisk -c; ls -l /data/adb/magisk'
```

기록상 이 runtime 준비는 아래에 따로 모은 화면 유지 서비스 설치보다 먼저 수행했다. 전체 wrapper는 첨부 `recorded-commands/08-magisk-runtime-setup.sh`에 있다.

실제 wrapper는 후보 해시를 다시 확인하고 아래 파일들을 올린 다음 preflight를 실행했다.

```sh
R=/data/local/tmp/aside-magisk-apply
"$ADB" -s "$ADB_TARGET" shell mkdir -p "$R"
"$ADB" -s "$ADB_TARGET" push "$W/init_boot.img" "$R/init_boot.signed.img"
"$ADB" -s "$ADB_TARGET" push "$W/vbmeta.img" "$R/vbmeta.signed.img"
"$ADB" -s "$ADB_TARGET" push "$M/current-init_boot_b.img" "$R/init_boot.original.img"
"$ADB" -s "$ADB_TARGET" push "$M/current-vbmeta_b.img" "$R/vbmeta.original.img"
"$ADB" -s "$ADB_TARGET" push "$M/apply-signed-pair.sh" "$R/apply.sh"
"$ADB" -s "$ADB_TARGET" push "$M/preflight-only.sh" "$R/preflight-only.sh"
"$ADB" -s "$ADB_TARGET" shell 'chmod 700 /data/local/tmp/aside-magisk-apply; chmod 400 /data/local/tmp/aside-magisk-apply/*.img; chmod 700 /data/local/tmp/aside-magisk-apply/*.sh'
"$ADB" -s "$ADB_TARGET" shell sh "$R/preflight-only.sh" \
  || { echo '사전 검사 실패. 적용 중단'; exit 1; }
"$ADB" -s "$ADB_TARGET" shell 'nohup sh /data/local/tmp/aside-magisk-apply/apply.sh </dev/null >/data/adb/aside-magisk-backup/apply.log 2>&1 &'
STATE=''
for n in $(seq 1 20); do
  STATE=$("$ADB" -s "$ADB_TARGET" shell 'cat /data/adb/aside-magisk-backup/apply-state.txt 2>/dev/null || true')
  case "$STATE" in
    VERIFIED_PENDING_REBOOT|ROLLBACK*) break ;;
  esac
  sleep 1
done
"$ADB" -s "$ADB_TARGET" shell cat /data/adb/aside-magisk-backup/apply.log
[ "$STATE" = VERIFIED_PENDING_REBOOT ] || { echo '적용 미검증. 재부팅 금지'; exit 1; }
```

`apply.sh` 내부 쓰기는 다음과 같았다. 실패하면 원래 **두 파일을 모두** 되돌리기를 시도하고 해시를 비교하는 trap이 있으며, 그 전문도 첨부했다. 원복 성공은 `ROLLBACK_VERIFIED`를 따로 확인해야 하며 보장되는 것은 아니다.

```sh
# Android root shell 안. apply.sh의 내부 호출 기록이며 추가 실행하지 않는다.
B=/data/local/tmp/aside-magisk-apply
dd if="$B/init_boot.signed.img" of=/dev/block/by-name/init_boot_b bs=4096 count=2048 conv=fsync
sha256sum /dev/block/by-name/init_boot_b
dd if="$B/vbmeta.signed.img" of=/dev/block/by-name/vbmeta_b bs=4096 count=16 conv=fsync
sha256sum /dev/block/by-name/vbmeta_b
sync
```

처음에는 Android `mksh`의 `hash` 별칭과 함수명이 충돌해 쓰기 작업이 시작되기 전에 중단됐다. 보조 함수 이름을 `file_sha256`으로 바꾼 뒤 사전 검사를 다시 통과했다. 첨부는 수정 후 버전이다.

`VERIFIED_PENDING_REBOOT`와 두 물리 해시 일치를 확인한 뒤에만 재부팅했다.

```sh
INIT_EXPECTED_LINE=$(shasum -a 256 "$W/init_boot.img") || exit 1
VB_EXPECTED_LINE=$(shasum -a 256 "$W/vbmeta.img") || exit 1
INIT_ACTUAL_LINE=$("$ADB" -s "$ADB_TARGET" shell sha256sum /dev/block/by-name/init_boot_b) || exit 1
VB_ACTUAL_LINE=$("$ADB" -s "$ADB_TARGET" shell sha256sum /dev/block/by-name/vbmeta_b) || exit 1
INIT_EXPECTED=${INIT_EXPECTED_LINE%% *}
VB_EXPECTED=${VB_EXPECTED_LINE%% *}
INIT_ACTUAL=${INIT_ACTUAL_LINE%% *}
VB_ACTUAL=${VB_ACTUAL_LINE%% *}
for HASH in "$INIT_EXPECTED" "$VB_EXPECTED" "$INIT_ACTUAL" "$VB_ACTUAL"; do
  [ "${#HASH}" -eq 64 ] || { echo '해시 누락 또는 길이 오류. 재부팅 금지'; exit 1; }
  case "$HASH" in
    *[!0-9a-f]*) echo '해시 형식 오류. 재부팅 금지'; exit 1 ;;
  esac
done
[ "$INIT_ACTUAL" = "$INIT_EXPECTED" ] || { echo 'init_boot 불일치. 재부팅 금지'; exit 1; }
[ "$VB_ACTUAL" = "$VB_EXPECTED" ] || { echo 'vbmeta 불일치. 재부팅 금지'; exit 1; }
"$ADB" -s "$ADB_TARGET" reboot
```

#### N. 재연결과 최종 루트·부팅·화면 확인

재부팅 후 무선 디버깅을 기기에서 다시 켜고, 새 주소로 연결했다. root adbd가 아니라 일반 shell에서 `su`가 작동하는지를 확인했다.

```sh
"$ADB" mdns services
export ADB_TARGET='재부팅 후 대상 기기의 IP:포트'
"$ADB" connect "$ADB_TARGET"
"$ADB" -s "$ADB_TARGET" shell id
"$ADB" -s "$ADB_TARGET" shell su -c id
"$ADB" -s "$ADB_TARGET" shell "su -c 'magisk -v; magisk -V'"
"$ADB" -s "$ADB_TARGET" shell getprop sys.boot_completed
"$ADB" -s "$ADB_TARGET" shell getprop ro.boot.slot_suffix
"$ADB" -s "$ADB_TARGET" shell getprop ro.boot.flash.locked
"$ADB" -s "$ADB_TARGET" shell getprop ro.boot.verifiedbootstate
"$ADB" -s "$ADB_TARGET" shell "su -c 'sha256sum /dev/block/by-name/init_boot_b /dev/block/by-name/vbmeta_b'"
```

`su`가 처음 거절된 시도도 있었다. 최종 성공은 앱의 권한 허용 이후 일반 shell에서 `uid=0(root)`와 `u:r:magisk:s0`가 반환된 기록을 기준으로 했다.

**다음 블록은 앞서 재부팅 전에 수행한 부가 작업을 따로 모은 기록이다. N 단계 뒤에 이어서 실행한 것이 아니다.** 부가적인 화면 유지 launcher는 재부팅 전 root ADB에서 Magisk boot service 경로에 설치했다. 미리 준비한 JAR와 launcher를 배치한 명령은 다음과 같았다.

```sh
"$ADB" -s "$ADB_TARGET" shell mkdir -p /data/adb/aside-keepawake /data/adb/service.d
"$ADB" -s "$ADB_TARGET" push "$M/keepawake/keepawake.jar" /data/adb/aside-keepawake/keepawake.jar
"$ADB" -s "$ADB_TARGET" push "$M/keepawake/aside-keepawake-installed.sh" /data/adb/service.d/aside-keepawake.sh
"$ADB" -s "$ADB_TARGET" shell 'chmod 700 /data/adb/aside-keepawake; chmod 444 /data/adb/aside-keepawake/keepawake.jar; chmod 755 /data/adb/service.d/aside-keepawake.sh; nohup sh /data/adb/service.d/aside-keepawake.sh </dev/null >/dev/null 2>&1 &'
```

기기 안에서 launcher가 실행하는 명령은 다음 형태였다.

```sh
# Android root shell. keepawake.jar와 launcher 설치 뒤 실행되는 내용이다.
CLASSPATH=/data/adb/aside-keepawake/keepawake.jar \
  /system/bin/app_process /system/bin --nice-name=aside.keepawake \
  io.aside.keepawake.KeepAwake \
  </dev/null >>/data/adb/aside-keepawake/keepawake.log 2>&1 &
```

launcher는 `sys.boot_completed=1`을 기다리고 이미 실행 중인 프로세스가 없는지도 확인했다. 재부팅 후 `dumpsys power`에서 wake lock과 `Awake` 상태를 확인했다.

```sh
"$ADB" -s "$ADB_TARGET" shell "su -c 'dumpsys power'"
```

화면 유지를 위한 JAR 자체와 기기별 원본 설정은 첨부하지 않았다. 이 부가 기능은 OS 설치·Magisk 루트 성공의 필수 단계는 아니다.

## 참고 자료

- [프론트2 GSI 커뮤니티 작업기](https://gall.dcinside.com/mgallery/board/view/?id=sff&no=1750496)와 [별도 재현 사례](https://gall.dcinside.com/mgallery/board/view/?id=sff&no=1767585): 빌드·기기 정보를 참고했지만 실제 쓰기 경로는 본문처럼 따로 구성했다.
- [bkerler/edl](https://github.com/bkerler/edl)
- [AOSP Android Verified Boot](https://source.android.com/docs/security/features/verifiedboot/avb)
- [AOSP 동적 파티션](https://source.android.com/docs/core/ota/dyn)
- [AOSP fastbootd](https://source.android.com/docs/core/architecture/bootloader/fastbootd)
- [Magisk 공식 설치 문서](https://topjohnwu.github.io/Magisk/install.html): 일반적인 설치 전제와 이번 기기의 서명 유지 경로는 구분해야 한다.
- [Magisk 31.1 릴리스](https://github.com/topjohnwu/Magisk/releases/tag/v31.1)
- [Marinov LineageOS 22.2 Light GSI 배포 스레드](https://xdaforums.com/t/gsi-15-marinov-lineageos-22-2-light.4762304/)

본문의 실기기 결과는 개인 작업 로그, 파티션 재읽기 검증과 재부팅 후 상태 기록을 기준으로 정리했다.
