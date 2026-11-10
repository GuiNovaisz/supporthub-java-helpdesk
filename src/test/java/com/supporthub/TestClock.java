package com.supporthub;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

@TestConfiguration
class TestClock {
    static final Instant START = Instant.parse("2026-11-10T13:00:00Z");

    @Bean
    @Primary
    MutableClock testTime() {
        return new MutableClock();
    }

    static final class MutableClock extends Clock {
        private final AtomicReference<Instant> time = new AtomicReference<>(START);

        void set(Instant instant) {
            time.set(instant);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return Clock.fixed(instant(), zone);
        }

        @Override
        public Instant instant() {
            return time.get();
        }
    }
}
