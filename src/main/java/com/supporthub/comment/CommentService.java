package com.supporthub.comment;

import com.supporthub.shared.PageResult;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CommentService {
    private final CommentRepository comments;

    CommentService(CommentRepository comments) {
        this.comments = comments;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public CommentView add(UUID ticketId, UUID authorId, String body, Visibility visibility, Instant now) {
        return comments.save(new TicketComment(ticketId, authorId, body, visibility, now)).view();
    }

    @Transactional(readOnly = true, propagation = Propagation.MANDATORY)
    public PageResult<CommentView> list(UUID ticketId, boolean staff, int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by("createdAt", "id"));
        var result = staff ? comments.findByTicketId(ticketId, pageable)
                : comments.findByTicketIdAndVisibility(ticketId, Visibility.PUBLIC, pageable);
        return PageResult.from(result, TicketComment::view);
    }

    public record CommentView(UUID id, UUID authorId, String body, Visibility visibility, Instant createdAt) {}
}
