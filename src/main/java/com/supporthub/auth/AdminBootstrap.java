package com.supporthub.auth;

import com.supporthub.user.UserDtos.CreateAccount;
import com.supporthub.user.UserService;
import jakarta.validation.Validator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
class AdminBootstrap implements ApplicationRunner {
    private final UserService users;
    private final Validator validator;
    private final String email;
    private final String password;

    AdminBootstrap(UserService users, Validator validator,
                   @Value("${supporthub.bootstrap.email:}") String email,
                   @Value("${supporthub.bootstrap.password:}") String password) {
        this.users = users;
        this.validator = validator;
        this.email = email;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (email.isEmpty() && password.isEmpty()) {
            return;
        }
        var account = new CreateAccount("SupportHub Administrator", email, password);
        if (!validator.validate(account).isEmpty() || UserService.passwordTooLong(password)) {
            throw new IllegalStateException("Invalid administrator bootstrap credentials.");
        }
        users.bootstrapAdmin(account);
    }
}
