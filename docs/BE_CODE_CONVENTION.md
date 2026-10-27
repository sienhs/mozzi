## 1. Java 코딩 컨벤션

### 1.1 패키지/클래스/메서드/변수 명명 규칙

1. **패키지명**
    - **소문자** 사용, 일반적으로 도메인 역순으로 구성.
    - 예: `com.example.myapp`
2. **클래스/인터페이스명**
    - **파스칼 케이스(PascalCase)** 사용.
    - 명사 형태, 인터페이스는 적용 패턴의 관례를 따름.
    - `able` /**`template`**
    - 예: `public class UserService`, `public interface Runnable`
3. **메서드명**
    - **카멜 케이스(camelCase)** 사용.
    - 동사 또는 동사구 형태, 역할을 명확히.
    - 예: `getUserById()`, `calculateTotalPrice()`
4. **변수명**
    - **카멜 케이스(camelCase)** 사용.
    - 의미가 명확하도록 작성, 축약형 지양.
    - 예: `int userCount`, `String firstName`
5. **상수명**
    - 모든 문자를 대문자로, 단어 간 구분은 언더스코어(`_`) 사용.
    - 예: `public static final int MAX_SIZE = 100;`
6. **DB**
    - **스네이크 케이스(snake_case)** 사용
    - DBMS예약어 사용 금지

### 1.2 들여쓰기/공백/중괄호

1. **들여쓰기**
    - **스페이스 4칸.** `.editorconfig`(`[*.java] indent_size = 4`)와 기존 코드가 기준이다.
    - 포맷은 손으로 맞추지 않는다. `gradlew spotlessApply` 가 정리하고, CI 의 `gradlew check`
      가 어긋난 포맷을 떨어뜨린다. 전체 재포맷터(google-java-format 은 2칸)는 도입하지 않는다 —
      `.editorconfig` 와 싸우고, 한 번 돌리면 모든 파일이 diff 에 올라와 리뷰가 불가능해진다.
2. **중괄호 위치**
    - K&R 스타일(**한 줄 위에 여는 중괄호**):

        ```java
        public void example() {
            // ...
        }
        ```

3. **띄어쓰기**
    - 연산자 주위에 공백 권장: `int sum = a + b;`
    - `if`, `for` 등의 키워드 뒤에 공백: `if (condition) { ... }`

### 1.3 주석(Comment)

1. **Javadoc 주석**
    - 클래스, 메서드, 필드에 대한 설명 사용:

        ```java
        /**
         * 사용자 정보를 반환합니다.
         *
         * @param id 사용자 ID
         * @return 사용자 객체
         */
        public User getUserById(Long id) { ... }
        ```

2. **라인 주석**
    - 불분명한 로직 또는 주의가 필요한 부분:

        ```java
        // 사용자 정보를 DB에서 조회
        User user = userRepository.findById(id);
        ```


### 1.4 기타 권장 사항

- **에러 처리**: 충분히 의미 있는 예외를 던지고, `try-catch` 시 구체적인 메시지 로그.
- **컬렉션 타입**: 제네릭(Generics)을 사용해 타입 안정성 보장.
- **코드 길이 제어**: 메서드가 너무 길어지지 않도록 분리해서 작성.

---

## 2. Spring 코드 컨벤션

### 2.1 패키지 구조

일반적으로 다음과 같은 **도메인 레이어 아키텍처**를 사용:

```
com.example.domain
 └─ users
		 ├─ Controller
		 ├─ Service
		 └─ Repository
 └─ config
 └─ global
```

- **Controller/Web**: HTTP 요청/응답 처리.
- **Service**: 비즈니스 로직 처리.
- **Repository/DAO**: 데이터베이스 접근.
- **Domain/Model/Entity**: 엔티티 클래스, VO, DTO 등.
- **Config**: 설정 관련 클래스.

### 2.2 클래스 및 어노테이션 규칙

1. **Controller** 클래스
    - `@RestController` 또는 `@Controller` 사용.
    - 요청 경로를 `@RequestMapping`(클래스 레벨) 또는 `@GetMapping`, `@PostMapping`(메서드 레벨)로 선언.
2. **Service** 클래스
    - `@Service` 사용.
    - 트랜잭션이 필요한 경우 `@Transactional` 부여.
3. **Repository** 클래스
    - `@Repository` 사용 또는 JPA에서는 `CrudRepository`, `JpaRepository` 등을 상속.
    - 데이터 접근 로직 구현.
4. **Entity** 클래스
    - `@Entity`, `@Table` 사용.
    - 필드는 `@Id`, `@Column`으로 매핑.

### 2.3 Bean 주입 방식

- **생성자 주입** 권장:

    ```java
    @Service
    public class UserService {
        private final UserRepository userRepository;
    
        public UserService(UserRepository userRepository) {
            this.userRepository = userRepository;
        }
        // ...
    }
    ```

- **필드 주입**은 테스트나 유지보수 관점에서 비추천.
- **Setter 주입**은 선택적인 의존성에만 사용.

### 2.4 예외 처리

- **ControllerAdvice**와 **@ExceptionHandler**를 사용하여 전역 예외 처리.
- 예외 발생 시 명확한 메시지와 상태 코드를 반환.

---

## 3. Spring Boot 코드 컨벤션

### 3.1 애플리케이션 구조

```
com.ssafy.mozzi
├── MozziApplication.java
├── global                   공통 기반 — 5장 참고
│   ├── config
│   ├── exception
│   ├── logging
│   ├── response
│   ├── security
│   └── util
├── domain                   업무 도메인 (API 명세 4장 기준)
│   ├── member
│   │   ├── controller
│   │   ├── service
│   │   ├── repository
│   │   ├── entity
│   │   └── dto
│   ├── auth
│   ├── diary
│   ├── image
│   ├── calendar
│   ├── search               감정 검색
│   └── gacha
└── integration              외부 연동 (Google · 이미지 모델 · LLM · S3)
```

- **메인 클래스**(`MozziApplication`)는 루트 패키지에 위치해 컴포넌트 스캔이 패키지 하위까지 적용되도록 함.
- 도메인 패키지는 **필요해질 때 만든다.** 빈 패키지를 미리 만들어 두면 어디까지 구현됐는지 알 수 없다.

### 3.2 프로퍼티/설정 파일 관리

- **`application.yml`** 에 공통 설정, 프로파일별 설정은 `application-local.yml` ·
  `application-prod.yml` · `application-test.yml` 로 분리.
- 런타임 프로파일은 `local` · `prod` 둘뿐이다. 패키징된 jar 는 둘 중 **정확히 하나**가 지정되지
  않으면 기동을 거부한다(`ProfileGuard`). 오타난 프로파일로 뜬 서버가 기본 설정으로 도는 걸 막는다.
- 비밀값은 yml 에 쓰지 않는다. 환경변수(k8s Secret)로 주입하고 `.env.example` 에 키 이름만 남긴다.
- 빈 설정은 최대한 `@ConfigurationProperties` 를 사용해 명시적으로 관리.

### 3.3 자동 설정(Autoconfiguration)과 사용자 설정

- Spring Boot가 제공하는 **Auto Configuration**을 최대한 활용.
- 필요 시 **`@Configuration`** 클래스로 추가 설정.
- **Boot 4 는 모듈 이름이 바뀌었다.** `spring-boot-starter-web` 대신
  `spring-boot-starter-webmvc`, 테스트는 `spring-boot-starter-webmvc-test` 계열이고
  `@AutoConfigureMockMvc` 는 `org.springframework.boot.webmvc.test.autoconfigure` 로 옮겨졌다.
  Boot 3 기준 예제의 import 는 그대로 쓸 수 없다.

### 3.4 로깅(Logging)

- Logback 을 쓰고, `logback-spring.xml` 을 직접 만들지 않는다. Boot 의 구조화 로깅
  (`logging.structured.format.console`)으로 충분하다.
- 레벨과 개인정보 규칙은 **5.4** 에 있다. 로그에 무엇을 남기면 안 되는지는 그쪽을 먼저 읽는다.

---

## 4. 목록 조회 API 컨벤션

목록 응답 규칙. API 명세 1장의 페이지네이션 규약을 따른다.

> 이 장은 2026-10-26 에 **offset(`PagedModel`) 에서 커서로 교체**됐다. 이전 기준 구현
> (`domain/concert` 의 `findAll` 계열)은 이 저장소에 없다. 명세가 `?cursor={opaque}&size=20` →
> `nextCursor` 로 정해져 있어 두 방식을 섞으면 클라이언트가 두 가지 페이징을 구현해야 한다.

### 4.1 응답

성공 응답은 공통 래퍼로 감싸지 않는다. 목록은 **`CursorPage<{도메인}SummaryResponseDto>`**
(`global/response/CursorPage`) 로 반환한다.

```json
{
  "items": [ { "diaryId": 101, "recordDate": "2026-10-21", "emotion": "SAD" } ],
  "nextCursor": "eyJpZCI6OTB9"
}
```

- `nextCursor` 는 **마지막 페이지에서 `null`**. 클라이언트는 이 값이 `null` 이면 멈춘다.
  `hasNext` 같은 불리언을 따로 두지 않는다 — 두 필드가 어긋날 수 있다.
- **`null` 을 키째로 지우지 않는다.** 명세 1.1 규약이고, 클라이언트가 키 존재를 전제로 분기한다.
  `spring.jackson.default-property-inclusion: always` 가 이걸 보장한다(5.2).
- `totalElements` · `totalPages` 는 **주지 않는다.** 커서 페이징에서 전체 개수를 세려면 매 요청마다
  별도 count 쿼리가 필요하고, 그게 목록 조회보다 무겁다. 전체 개수가 화면에 필요하면
  (캘린더의 `recordedCount` 처럼) 그 화면 전용 응답 필드로 따로 내린다.
- 목록 항목은 `{도메인}SummaryResponseDto`, 상세는 `{도메인}DetailResponseDto` 로 이름 붙인다.

### 4.2 요청

- 조회 조건은 요청 DTO 하나로 묶어 `@Valid @ModelAttribute` 로 받는다. 검증 실패는 `400` ·
  `INVALID_INPUT` 과 `fieldErrors[{field, reason}]` 로 나간다(5.3).
- 기본값은 `size=20`, **상한 100**. 상한이 없으면 한 번의 요청으로 테이블 전체를 끌어갈 수 있다.
- `cursor` 는 **선택값**이다. 없으면 첫 페이지. 파라미터 없이 호출해도 결과가 나와야 한다.
- 문자열 검색어가 공백뿐이면 조건에서 뺀다. `like '%%'` 는 결과가 전체 조회와 같으면서 인덱스만
  못 탄다.
- **`Pageable` 을 컨트롤러에서 받지 않는다.** 커서 페이징과 규약이 겹쳐 두 가지 페이징이 한
  엔드포인트에 생긴다.

### 4.3 커서

- **커서는 클라이언트에게 불투명해야 한다.** 정렬 키를 Base64url 로 인코딩해 내린다. 날짜나 id 를
  그대로 노출하면 클라이언트가 그 값을 해석해 쓰기 시작하고, 정렬 기준을 바꾸는 순간 깨진다.
- **커서에 유일 키(`id`)를 반드시 포함한다.** `record_date` 만으로 자르면 같은 날짜 행이 여러 개일
  때 페이지를 넘기면서 같은 행이 두 번 나오거나 아예 빠진다. 조건도
  `(record_date, id) < (:date, :id)` 형태의 복합 비교로 쓴다.
- 정렬 기준을 여러 개 열어야 하면 **enum 화이트리스트로만** 받고, 커서에 어떤 기준으로 만든
  커서인지도 담는다. 정렬을 바꿔 가며 같은 커서를 쓰면 결과가 무의미해진다.
- 커서를 해석할 수 없으면 `400 INVALID_INPUT` 이다. 조용히 첫 페이지로 돌려보내면 클라이언트가
  무한 스크롤에서 같은 페이지를 반복한다.
- 조회는 **`size + 1` 건을 읽는다.** `CursorPage.of(fetched, size, cursorOf)` 가 초과분을 떼고
  `nextCursor` 를 만든다. 다음 페이지 존재 여부를 위해 count 쿼리를 날리지 않아도 된다.

### 4.4 조회 쿼리

- **다대일 연관만 `fetch join` 한다.** 컬렉션을 함께 걸면 행이 늘어 DB 에서 `limit` 을 걸 수 없고,
  Hibernate 가 전부 읽어 메모리에서 자른다.
- 그래서 **목록 응답에 컬렉션 필드를 담지 않는다.** 연관 목록은 상세 조회에서 준다. 꼭 필요하면
  페이지를 먼저 조회하고 그 id 목록으로 두 번째 쿼리를 날린다.
  (예외: 명세의 `DiarySummary.activities` 는 한 건당 최대 8개로 묶여 있어 두 번째 쿼리로 채운다.)
- 선택 조건은 `(:param is null or ...)` 로 처리한다.
- 소프트 삭제된 행은 목록에서 빠져야 한다. 엔티티에 `@SQLRestriction("deleted_at is null")` 이
  붙어 있으면 Hibernate 가 생성하는 모든 조회에서 빠진다 — 5.5 참고.
- 목록 조회는 **부수 효과가 없어야 한다.** `@Transactional(readOnly = true)` 를 붙인다.

### 4.5 페이징하지 않는 목록

전체 집합이 있어야 화면이 성립하는 목록은 페이지로 나누지 않는다. 명세에서는 캘린더
(`GET /calendar` 는 해당 월 28~31일 전체)와 도감(`GET /gacha/collection`)이 그렇다 — 20개씩
끊어 받으면 화면이 여러 번 호출을 기다려야 해서 오히려 느리다.

예외로 두는 대신 **응답 크기를 다른 방법으로 묶는다.**

- 조회 범위를 상위 묶음 하나로 제한한다. 캘린더는 `yearMonth` 단위, 도감은 `seasonId` 단위로만
  조회하게 해 응답이 전체 기록이 아니라 한 달 · 한 시즌(100장) 크기로 묶인다.
- 집계는 항목마다 세지 말고 `group by` 한 번으로 모은다. 묶음 수만큼 count 쿼리를 날리면 N+1 이다.
  집계 결과에 없는 묶음은 읽는 쪽에서 0 으로 채운다 — 빠뜨리면 화면에서 사라진다.

페이징을 생략할 때는 **무엇이 응답 크기를 묶어 주는지**를 DTO 주석에 남긴다. 근거 없이 생략하면
데이터가 늘었을 때 그대로 터진다.

### 4.6 새 목록 API 체크리스트

- [ ] 응답이 `CursorPage<{도메인}SummaryResponseDto>` 인가
      (페이징을 생략한다면 4.5 의 조건을 만족하고, 그 근거를 주석에 남겼는가)
- [ ] `size` 기본값 20 과 상한 100 을 두었는가
- [ ] 커서가 불투명하고, 유일 키를 포함하며, 깨진 커서에 `400` 을 주는가
- [ ] `size + 1` 건을 읽어 `CursorPage.of` 로 조립했는가 (count 쿼리 없음)
- [ ] 컬렉션을 `fetch join` 하지 않았는가
- [ ] `@Transactional(readOnly = true)` 이고 부수 효과가 없는가
- [ ] 소프트 삭제된 행이 빠지는가
- [ ] 커서를 두 페이지 이상 넘겨 보는 통합 테스트가 있는가 (한 페이지만 보면 중복·누락을 못 잡는다)

---

## 5. 공통 레이어 (`global`)

전 API 가 공유하는 규약이다. 여기를 바꾸면 모든 엔드포인트가 같이 바뀌므로, 각 항목에는 그걸
고정하는 테스트가 있다.

### 5.1 패키지

```
global
├── config      WebConfig(/api/v1 prefix) · ClockConfig · ProfileGuard
├── exception   ErrorCode · CommonErrorCode · BusinessException
│               ErrorResponse · GlobalExceptionHandler · ErrorResponseWriter
├── logging     RequestTrace(MDC) · TraceIdFilter · RequestLoggingFilter
├── response    CursorPage
├── security    AuthenticationFilter · PublicEndpoints(화이트리스트) · AccessTokenProvider(JWT)
│               AuthenticatedMember · SecurityErrorCode
└── util        Masker
```

- `response` 는 성공 응답 공용 타입, `exception` 은 에러 코드 · 예외 · 에러 응답이다.
- **성공 응답 봉투(`ApiResponse<T>`)는 만들지 않는다.** 명세가 리소스를 그대로 반환하고 의미를
  상태 코드로 구분하기로 정했다(명세 1.1).

### 5.2 Jackson — Boot 4 는 Jackson 3 다 ⚠️

Spring Boot 4 는 **Jackson 3**(`tools.jackson.databind`)을 쓴다. Boot 2/3 기준 예제를 그대로
가져오면 안 된다.

- `ObjectMapper` 는 `tools.jackson.databind.ObjectMapper` 다. 애노테이션만 예외로 아직
  `com.fasterxml.jackson.annotation` 에 있다(`@JsonProperty` 등은 그대로 쓴다).
- springdoc 이 swagger-core 때문에 **Jackson 2 databind 를 같이 끌고 온다.** 그래서
  `com.fasterxml.jackson.databind.ObjectMapper` 를 import 해도 컴파일되고 실행된다 — 다만 그건
  애플리케이션이 설정한 매퍼가 아니라서, `application.yml` 설정이 전부 무시되는 것처럼 보인다.
  `ArchitectureTest` 가 이 import 를 막는다.
- 날짜 기능이 `SerializationFeature` 에서 **`DateTimeFeature` 로 옮겨졌다.** 설정 키는
  `spring.jackson.datatype.datetime.*` 다. 구 키
  `spring.jackson.serialization.write-dates-as-timestamps` 는 기동 시
  `ConversionFailedException` 으로 죽는다(조용히 무시되지는 않는다).
- `spring.jackson.time-zone: Asia/Seoul` 이 없으면 `OffsetDateTime` 이 UTC 로 정규화돼
  `+09:00` 대신 `Z` 로 나간다. 명세 1장의 일시 포맷이 깨진다.

> 고정 테스트: `JacksonSerializationTest`

### 5.3 에러 응답

- 모든 에러는 명세 1.2 의 `{code, message, fieldErrors, traceId}` 로 나간다. **RFC 9457
  ProblemDetail 은 쓰지 않는다**(`spring.mvc.problemdetails.enabled: false`).
- `code` 는 클라이언트가 분기하는 식별자다. **문구를 바꾸듯 바꾸지 않는다.**
- `message` 는 **사용자에게 그대로 보여 줄 문장**이다. 개발자용 상세를 넣지 않는다.
  `BusinessException` 의 2번째 인자는 **로그용**이고 응답에 나가지 않는다 — 실수로 잘못 써도
  내부 정보가 응답이 아니라 로그로 간다.
- **도메인마다 자기 `ErrorCode` enum 을 만든다.** 프로젝트 전역 enum 하나로 두면 모든 기능
  브랜치가 같은 파일을 고쳐 매번 충돌한다.
- 새 Spring 예외를 만나면 `GlobalExceptionHandler` 에 핸들러를 **추가한다.** 안 하면 Spring 기본
  에러 바디가 새어 나가고, local 프로파일에서는 요청 본문까지 그대로 돌려준다.
- 필터 체인에서 끊는 요청(인증 · 레이트 리밋)은 `GlobalExceptionHandler` 에 닿지 않는다.
  **`ErrorResponseWriter` 를 쓴다** — 양쪽이 같은 바디를 내도록 하는 유일한 장치다.

> 고정 테스트: `ErrorResponseContractTest` · `ErrorResponseWriterTest`

### 5.4 로깅과 개인정보

- prod 는 stdout 에 **ECS JSON 한 줄씩**(`logging.structured.format.console: ecs`). k3s 로그
  수집기가 읽는 형식이다. 로컬은 사람이 읽는 기본 포맷.
- **요청 · 응답 본문과 쿼리 스트링을 로그에 남기지 않는다.** 이 서비스가 다루는 건 일기 본문,
  감정 검색 질문, Google id 토큰, FCM 토큰이고 전부 본문 아니면 쿼리 파라미터로 온다
  (`?nickname=하루`). 가릴 필드를 나열하는 방식은 필드가 늘 때마다 샌다.
- 특정 값을 꼭 찍어야 하면 그 값을 가진 서비스에서 **`Masker` 를 통과시켜** 찍는다.
- `diary_image.prompt` 는 DB 에 저장하지만 **로그로는 금지**다. 프롬프트에 일기 본문이 들어간다.
- prod 에서 `com.ssafy.mozzi` 를 DEBUG 로 올리지 않는다. 바인딩된 요청 객체가 찍히면서 위의
  전부가 로그 저장소로 간다.
- MDC 키는 `RequestTrace` 에 모아 둔다. `traceId` 는 모든 요청에 붙고 `X-Trace-Id` 응답 헤더와
  에러 바디의 `traceId` 가 같은 값이다 — 사용자가 신고한 에러를 한 번의 검색으로 찾는다.
- **비동기 작업(그림 생성 워커)에는 MDC 가 자동으로 전파되지 않는다.** 스레드 풀을 도입할 때
  `TaskDecorator` 로 MDC 를 넘겨야 한다. 안 하면 "누구의 어느 일기가 실패했나"를 로그에서 못 찾는다.

> 고정 테스트: `TraceIdFilterTest` · `MaskerTest`

### 5.5 시간과 소프트 삭제

- **`LocalDate.now()` 같은 무인자 `now()` 를 쓰지 않는다.** `Clock` 빈(Asia/Seoul)을 주입받는다.
  명세 4.4 의 "오늘만 허용 + 자정 후 3시간 유예"는 시계를 옮길 수 있어야 테스트된다.
  `ArchitectureTest` 가 무인자 `now()` 호출을 막는다.
- 컨테이너와 테스트 JVM 모두 `Asia/Seoul` 로 고정돼 있다(`Dockerfile`, `build.gradle` 의
  `test` 태스크). CI 컨테이너는 UTC 가 기본이라, 고정하지 않으면 날짜 단정이 로컬에서는 통과하고
  파이프라인에서 깨진다.
- 소프트 삭제는 `deleted_at DATETIME` 으로 통일한다(`is_deleted` 불리언을 쓰지 않는다 — 언제
  지웠는지 알아야 보관 기간 배치를 돌릴 수 있다).
- `@SQLRestriction("deleted_at is null")` 은 **PK 직접 조회에도 적용된다.** "`findById` 는
  `EntityManager.find` 라서 빠져나간다"는 이야기가 널리 퍼져 있는데(구 버전 `@Where` 기준),
  Hibernate 7 에서는 사실이 아니다 — `MemberRepositoryTest` 가 JDBC 로 행이 남아 있음을 먼저
  확인한 뒤 `findById` 가 빈 값을 주는 것을 고정한다.
- 그래도 조회 메서드 이름에 `DeletedAtIsNull` 을 **명시한다.** 호출하는 쪽에서 의도가 보이고,
  나중에 어떤 엔티티에서 애노테이션을 떼더라도 조회 범위가 조용히 넓어지지 않는다. 같은 자리에
  `memberId` 조건을 함께 넣어 명세 1.3 의 "남의 리소스도 404" 규칙을 해결한다
  (`findByIdAndMemberIdAndDeletedAtIsNull`).
- 반대쪽 함정이 있다. 애노테이션이 모든 조회에 걸리므로 **삭제된 행에 일부러 접근해야 하는 경우
  JPQL·파생 쿼리로는 불가능하다.** 꼭 필요하면 네이티브 쿼리로 쓰고, 왜 네이티브인지 주석을
  남긴다. (탈퇴 후 재가입은 2026-10-27 정책 변경으로 즉시 허용되고 새 회원 ID 로 가입하므로,
  더 이상 탈퇴한 행을 조회하지 않는다.)
- PostgreSQL 에서 "하루 1기록, 삭제된 기록은 제외"는 **부분 유니크 인덱스**로 쓴다
  (`create unique index ... on diary (member_id, record_date) where deleted_at is null`).
  회원도 같다: Google 계정(`uq_member_active_provider_subject`)과 대소문자 무시 닉네임
  (`uq_member_active_nickname`, `lower(nickname)`)은 활성 회원 사이에서만 유일하다.
  명세 ERD 의 `active_key` 생성 컬럼은 MySQL 용 우회라 필요 없다.

### 5.6 데이터베이스와 마이그레이션

PostgreSQL 17.11. 로컬은 `backend/compose.yaml` (`cd backend && docker compose up -d`),
테스트는 Testcontainers 가 **같은 이미지 태그**로 띄운다. 두 곳의 태그가 어긋나면 아무도 쓰지
않는 버전에서만 통과하는 테스트가 생긴다.

- **스키마는 Flyway 가 소유한다.** `ddl-auto: validate` 라서 엔티티와 스키마가 어긋나면 기동이
  실패한다. `update` 로 바꾸지 않는다 — Hibernate 와 Flyway 가 같은 스키마를 양쪽에서 고치게 된다.
- 마이그레이션은 `src/main/resources/db/migration/V{n}__{설명}.sql`. **한 파일에 한 도메인**까지만
  담는다. ERD 전체를 한 파일에 쓰면 리뷰가 불가능하고, 공유 DB 에서 한 번 실행된 뒤에는 수정도
  못 한다(`validate-on-migrate: true` 가 수정된 파일을 기동 실패로 만든다).
- **이미 실행된 파일은 고치지 않는다.** 새 `V{n+1}` 을 추가한다. 로컬에서 처음부터 다시 만들려면
  `docker compose down -v`.
- 타입은 `timestamptz` 를 쓴다. `timestamp`(without time zone)는 오프셋을 조용히 버려서, 00:30 KST
  에 쓴 기록이 전날 날짜로 보이게 된다. `SchemaMigrationTest` 가 이걸 고정한다.
- PK 는 `bigint generated by default as identity` + 엔티티는 `GenerationType.IDENTITY`.
- 컬럼은 snake_case, 자바 필드는 camelCase. Boot 기본 네이밍 전략이 변환하고,
  `SchemaMigrationTest` 가 대문자 섞인 컬럼이 없음을 확인한다.
- 모든 테이블은 `created_at` · `updated_at` 을 갖고, 엔티티는 `BaseTimeEntity` 를 상속한다.
  타임스탬프는 **`Clock` 빈**에서 온다(`JpaAuditingConfig`) — 기본 제공자는 머신 시계를 읽어서
  `created_at` 만 테스트로 옮길 수 없는 값이 된다.
- enum 은 `@Enumerated(EnumType.STRING)`. ordinal 은 enum 상수 순서를 바꾸는 순간 기존 행의 뜻이
  달라진다.
- **readiness 에 DB 가 포함된다.** DB 를 내리면 liveness 는 200(9ms), readiness 는 503(약 3초)이다.
  배포 매니페스트의 `readinessProbe.timeoutSeconds` 를 5 이상으로 둬야 쿠버네티스가 503 을 읽는다.

### 5.7 자동으로 검증되는 것들

| 장치 | 막는 것 |
|---|---|
| `gradlew check` (CI) | 테스트 + 포맷 드리프트 |
| `ArchitectureTest` | Jackson 2 databind import, 무인자 `now()` |
| `ErrorResponseContractTest` | 에러 바디 모양, `/api/v1` prefix, actuator 경로, 내부 정보 노출 |
| `ErrorResponseWriterTest` | 필터 체인 쪽 에러 바디가 컨트롤러 쪽과 어긋나는 것 |
| `JacksonSerializationTest` | 날짜 포맷, `+09:00` 오프셋, `null` 키 유지 |
| `SchemaMigrationTest` | 마이그레이션 누락, `timestamp` 오타입, 대문자 컬럼, 인덱스 누락 |
| `MemberRepositoryTest` | 소프트 삭제 조회 규약, auditing, enum 저장 방식 |
| `ddl-auto: validate` | 엔티티와 스키마 불일치 (기동 실패) |
| `validate-on-migrate` | 이미 실행된 마이그레이션 파일 수정 (기동 실패) |
| `ProfileGuard` | 프로파일 없이 · 두 개로 기동 |

> 테스트는 Docker 가 떠 있어야 돌아간다(Testcontainers). CI 는 `backend:test` 잡에 dind 서비스를
> 붙여 같은 경로로 검증한다.
