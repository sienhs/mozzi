// 출시용 서명 설정을 android/app/build.gradle에 넣는다(android/는 prebuild 산출물이라 직접 고치면 사라진다).
// 키와 비밀번호는 레포에 두지 않는다. 사용자 gradle.properties(~/.gradle/gradle.properties)의
// mozziReleaseSigning 에 서명 정보 파일 경로를 적어 두면 그 파일에서 읽는다.
//   storeFile=C:/.../mozzi-release.jks
//   storePassword=...
//   keyAlias=mozzi-release
//   keyPassword=...
// 경로가 없거나 파일이 없으면 지금처럼 debug 키로 서명하고 빌드 로그에 경고를 남긴다(팀원 로컬 빌드용).
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// mozzi-release-signing';

const loader = `${MARKER}
def mozziSigningPath = findProperty('mozziReleaseSigning')
def mozziSigning = new Properties()
def mozziSigningFile = mozziSigningPath ? file(mozziSigningPath) : null
if (mozziSigningFile != null && mozziSigningFile.exists()) {
    mozziSigningFile.withInputStream { mozziSigning.load(it) }
} else {
    logger.warn('mozziReleaseSigning 이 없어 release 빌드를 debug 키로 서명합니다. 스토어에 올리지 마세요.')
}
`;

const releaseConfig = `        release {
            if (mozziSigning['storeFile']) {
                storeFile file(mozziSigning['storeFile'])
                storePassword mozziSigning['storePassword']
                keyAlias mozziSigning['keyAlias']
                keyPassword mozziSigning['keyPassword']
            }
        }
`;

function apply(gradle) {
  if (gradle.includes(MARKER)) return gradle;
  let next = gradle.replace(/\nandroid \{/, `\n${loader}\nandroid {`);
  // debug 서명 설정 뒤에 release 서명 설정을 더한다.
  next = next.replace(
    /(signingConfigs \{\n\s+debug \{[\s\S]*?\n\s+\}\n)/,
    `$1${releaseConfig}`,
  );
  // release 빌드 타입이 debug 키 대신 release 키를 쓰게 한다(키 파일이 없으면 debug).
  next = next.replace(
    /(release \{\n(?:\s+\/\/.*\n)*\s+)signingConfig signingConfigs\.debug/,
    "$1signingConfig mozziSigning['storeFile'] ? signingConfigs.release : signingConfigs.debug",
  );
  if (
    !next.includes(MARKER) ||
    !next.includes("mozziSigning['storeFile'] ? signingConfigs.release")
  )
    throw new Error('withReleaseSigning: build.gradle 형식이 예상과 달라요.');
  return next;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, mod => {
    mod.modResults.contents = apply(mod.modResults.contents);
    return mod;
  });
};
module.exports.apply = apply;
