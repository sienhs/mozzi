package com.ssafy.mozzi.global.exception;

import java.util.ArrayList;
import java.util.List;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.validation.ObjectError;
import org.springframework.validation.method.ParameterErrors;
import org.springframework.validation.method.ParameterValidationResult;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.ssafy.mozzi.global.logging.RequestTrace;

/**
 * Turns every exception that reaches the dispatcher into the body from API spec 1.2.
 *
 * <p>Each Spring exception below has a handler on purpose. Anything left unhandled falls
 * through to Spring's own error body, which has a different shape and, with
 * {@code server.error.include-message=always} on the local profile, can echo the request
 * payload back to the client.
 *
 * <p>Requests rejected inside the filter chain (authentication, rate limiting) never reach
 * this class. Those go through {@link ErrorResponseWriter} so both paths produce the same
 * body.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private static final String INVALID_FORMAT_REASON = "형식에 맞지 않는 값이에요.";
    private static final String REQUIRED_REASON = "필수 값이에요.";
    private static final String UNKNOWN_FIELD = "request";

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusiness(BusinessException e) {
        ErrorCode errorCode = e.errorCode();
        if (errorCode.status().is5xxServerError()) {
            log.error("business failure: code={}", errorCode.code(), e);
        } else {
            // An expected 4xx is not an incident. Keeping it off ERROR leaves ERROR meaning
            // "someone has to look at this".
            log.warn("business failure: code={} detail={}", errorCode.code(), e.getMessage());
        }
        return ResponseEntity.status(errorCode.status())
                .body(ErrorResponse.of(errorCode, e.userMessage(), RequestTrace.traceId()));
    }

    /** {@code @Valid} on a request body. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleBodyValidation(MethodArgumentNotValidException e) {
        List<ErrorResponse.FieldError> fieldErrors = new ArrayList<>();
        for (FieldError error : e.getBindingResult().getFieldErrors()) {
            fieldErrors.add(new ErrorResponse.FieldError(error.getField(), error.getDefaultMessage()));
        }
        for (ObjectError error : e.getBindingResult().getGlobalErrors()) {
            // Class-level constraints carry no field. Dropping them would answer 400 with an
            // empty fieldErrors list and no reason at all.
            fieldErrors.add(new ErrorResponse.FieldError(error.getObjectName(), error.getDefaultMessage()));
        }
        return invalidInput(fieldErrors);
    }

    /**
     * Validation on a method parameter, which Spring reports separately from a request body.
     *
     * <p>Covers both {@code @Valid @ModelAttribute} query DTOs, where the per-field names
     * come from the nested {@link ParameterErrors}, and single constrained parameters such
     * as {@code @Size @RequestParam String nickname}, where the parameter name is the field.
     */
    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ErrorResponse> handleParameterValidation(HandlerMethodValidationException e) {
        List<ErrorResponse.FieldError> fieldErrors = new ArrayList<>();
        for (ParameterValidationResult result : e.getParameterValidationResults()) {
            if (result instanceof ParameterErrors errors) {
                for (FieldError error : errors.getFieldErrors()) {
                    fieldErrors.add(new ErrorResponse.FieldError(error.getField(), error.getDefaultMessage()));
                }
                continue;
            }
            String field = parameterName(result);
            for (MessageSourceResolvable error : result.getResolvableErrors()) {
                fieldErrors.add(new ErrorResponse.FieldError(field, error.getDefaultMessage()));
            }
        }
        return invalidInput(fieldErrors);
    }

    /** Constraints on a {@code @Validated} bean, outside the MVC argument resolvers. */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(ConstraintViolationException e) {
        List<ErrorResponse.FieldError> fieldErrors = new ArrayList<>();
        for (ConstraintViolation<?> violation : e.getConstraintViolations()) {
            fieldErrors.add(new ErrorResponse.FieldError(
                    String.valueOf(violation.getPropertyPath()), violation.getMessage()));
        }
        return invalidInput(fieldErrors);
    }

    /**
     * Malformed JSON, or a value that matches no enum constant.
     *
     * <p>The parser's own message is logged but never returned: it quotes the offending part
     * of the payload, which for this service means diary text or a Google id token.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadableBody(HttpMessageNotReadableException e) {
        log.warn("unreadable request body: cause={}", e.getMostSpecificCause().getClass().getSimpleName());
        return status(CommonErrorCode.INVALID_INPUT);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return invalidInput(List.of(new ErrorResponse.FieldError(e.getName(), INVALID_FORMAT_REASON)));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParameter(MissingServletRequestParameterException e) {
        return invalidInput(List.of(new ErrorResponse.FieldError(e.getParameterName(), REQUIRED_REASON)));
    }

    /** No handler and no static resource matched the path. */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResource() {
        return status(CommonErrorCode.NOT_FOUND);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotSupported() {
        return status(CommonErrorCode.METHOD_NOT_ALLOWED);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMediaTypeNotSupported() {
        return status(CommonErrorCode.UNSUPPORTED_MEDIA_TYPE);
    }

    /**
     * Anything unplanned. The exception message is logged with its stack trace and replaced
     * by a fixed sentence, so no internal detail can reach the client through it.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
        log.error("unhandled exception", e);
        return status(CommonErrorCode.INTERNAL_ERROR);
    }

    private static String parameterName(ParameterValidationResult result) {
        String name = result.getMethodParameter().getParameterName();
        // Null when the class was compiled without -parameters; Boot's Gradle plugin adds it,
        // but a plain javac build would otherwise produce "null" as the field name.
        return name != null ? name : UNKNOWN_FIELD;
    }

    private static ResponseEntity<ErrorResponse> status(ErrorCode errorCode) {
        return ResponseEntity.status(errorCode.status())
                .body(ErrorResponse.of(errorCode, RequestTrace.traceId()));
    }

    private static ResponseEntity<ErrorResponse> invalidInput(List<ErrorResponse.FieldError> fieldErrors) {
        // Field names are safe to log; the rejected values are not, so they stay out.
        log.warn("invalid input: fields={}", fieldErrors.stream().map(ErrorResponse.FieldError::field).toList());
        return ResponseEntity.status(CommonErrorCode.INVALID_INPUT.status())
                .body(ErrorResponse.of(CommonErrorCode.INVALID_INPUT, fieldErrors, RequestTrace.traceId()));
    }

}
