package com.supporthub.shared;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.ConstraintViolationException;
import java.io.IOException;
import java.util.Map;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiErrors {
    private static final Logger log = LoggerFactory.getLogger(ApiErrors.class);

    @ExceptionHandler(ApiException.class)
    ProblemDetail domain(ApiException failure) {
        return problem(failure.status(), failure.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail validation(MethodArgumentNotValidException failure) {
        var detail = problem(HttpStatus.UNPROCESSABLE_ENTITY, "Request validation failed.");
        detail.setProperty("errors", failure.getFieldErrors().stream()
                .map(error -> Map.of("field", error.getField(), "message", error.getDefaultMessage()))
                .toList());
        return detail;
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ProblemDetail malformed() {
        return problem(HttpStatus.BAD_REQUEST, "Malformed request or unsupported field value.");
    }

    @ExceptionHandler({HandlerMethodValidationException.class, ConstraintViolationException.class})
    ProblemDetail invalidParameters() {
        return problem(HttpStatus.UNPROCESSABLE_ENTITY, "Request parameters are outside their allowed range.");
    }

    @ExceptionHandler(AuthenticationException.class)
    ProblemDetail unauthorized() {
        return problem(HttpStatus.UNAUTHORIZED, "Authentication failed.");
    }

    @ExceptionHandler(AccessDeniedException.class)
    ProblemDetail forbidden() {
        return problem(HttpStatus.FORBIDDEN, "Access denied.");
    }

    @ExceptionHandler(PessimisticLockingFailureException.class)
    ProblemDetail concurrentWrite() {
        return problem(HttpStatus.CONFLICT, "Another operation is modifying this resource. Retry the request.");
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail unexpected(Exception failure) {
        if (failure instanceof ErrorResponse response) {
            return response.getBody();
        }
        log.error("Unexpected API failure", failure);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "The request could not be completed.");
    }

    public static ProblemDetail problem(HttpStatus status, String detail) {
        return ProblemDetail.forStatusAndDetail(status, detail);
    }

    public static void write(ObjectMapper mapper, HttpServletResponse response, HttpStatus status, String detail)
            throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        mapper.writeValue(response.getOutputStream(), problem(status, detail));
    }
}
