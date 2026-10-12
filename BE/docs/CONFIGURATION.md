# Backend configuration

The tracked `src/main/resources/application.properties` contains non-sensitive
defaults and imports `./application-local.properties`. The local file is ignored
by Git and contains development credentials. Do not commit that file or copy its
values into tracked configuration, test fixtures, command output, or logs.

## Windows PowerShell

Create `application-local.properties` in the project root once, then start with:

```powershell
.\mvnw.cmd spring-boot:run
```

The standard Maven goal includes `:run`; `mvnw.cmd spring-boot` by itself is not
a valid Maven goal. Production deployments should override local values through
environment variables or an external configuration file managed by the hosting
platform.

Automated tests use `src/test/resources/application.properties` and an isolated
in-memory H2 database with test-only placeholder credentials.

## Rotation

Credentials previously stored in tracked configuration must be treated as
compromised. Rotate the database password, JWT signing key, VNPay hash secret,
and social-provider secrets in their owning systems. Rotation is an operational
action and is intentionally not performed by the application or test suite.
