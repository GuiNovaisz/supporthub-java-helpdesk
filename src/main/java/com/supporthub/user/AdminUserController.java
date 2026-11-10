package com.supporthub.user;

import com.supporthub.shared.PageResult;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/users")
@Tag(name = "Users", description = "ADMIN only. Manage customer and agent activation and create agents.")
class AdminUserController {
    private final UserService users;

    AdminUserController(UserService users) {
        this.users = users;
    }

    @GetMapping
    PageResult<UserDtos.Account> list(@RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
                                      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return users.list(page, size);
    }

    @PostMapping("/agents")
    @ResponseStatus(HttpStatus.CREATED)
    UserDtos.Account createAgent(@Valid @RequestBody UserDtos.CreateAccount input) {
        return users.createAgent(input);
    }

    @PatchMapping("/{id}/status")
    UserDtos.Account status(@PathVariable UUID id, @Valid @RequestBody UserDtos.AccountStatus input) {
        return users.setActive(id, input.active());
    }
}
