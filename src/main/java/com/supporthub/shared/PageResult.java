package com.supporthub.shared;

import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;

public record PageResult<T>(List<T> items, int page, int size, long totalElements, int totalPages) {
    public static <S, T> PageResult<T> from(Page<S> page, Function<S, T> mapper) {
        return new PageResult<>(page.getContent().stream().map(mapper).toList(),
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
    }
}
