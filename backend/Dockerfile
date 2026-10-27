FROM eclipse-temurin:17-jre-jammy

# The API spec fixes the server timezone to Asia/Seoul: "today" decides which date a
# diary belongs to, so a UTC container would roll the date over 9 hours early.
# -Duser.timezone is authoritative for the JVM and needs no OS tzdata; ENV TZ keeps
# any non-JVM output (shell, core dumps) consistent with it.
ENV TZ=Asia/Seoul

WORKDIR /app
COPY build/libs/app.jar app.jar
ENTRYPOINT ["java", "-Duser.timezone=Asia/Seoul", "-jar", "app.jar"]
