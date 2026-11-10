create table user_account (
    id uuid primary key,
    name varchar(100) not null check (length(btrim(name)) > 0),
    email varchar(254) not null unique check (email = lower(btrim(email)) and length(email) > 0),
    password_hash varchar(72) not null,
    role varchar(16) not null check (role in ('CUSTOMER', 'AGENT', 'ADMIN')),
    active boolean not null,
    auth_version bigint not null default 0 check (auth_version >= 0),
    created_at timestamptz not null,
    updated_at timestamptz not null
);

create sequence ticket_reference_seq as bigint;

create table ticket (
    id uuid primary key,
    reference varchar(23) not null unique check (reference ~ '^SUP-[0-9]{6,19}$'),
    title varchar(160) not null check (length(btrim(title)) > 0),
    description varchar(8000) not null check (length(btrim(description)) > 0),
    status varchar(24) not null check (status in ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED')),
    priority varchar(16) not null check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    requester_id uuid not null references user_account (id),
    assigned_agent_id uuid references user_account (id),
    created_at timestamptz not null,
    updated_at timestamptz not null,
    first_response_at timestamptz,
    resolved_at timestamptz,
    closed_at timestamptz,
    first_response_due_at timestamptz not null,
    resolution_due_at timestamptz not null,
    check (first_response_due_at > created_at and resolution_due_at > first_response_due_at),
    check ((status in ('RESOLVED', 'CLOSED')) = (resolved_at is not null)),
    check ((status = 'CLOSED') = (closed_at is not null))
);

create index ticket_requester_idx on ticket (requester_id, created_at desc, id desc);
create index ticket_queue_idx on ticket (status, priority, created_at desc, id desc);
create index ticket_agent_idx on ticket (assigned_agent_id, created_at desc, id desc);

create table ticket_comment (
    id uuid primary key,
    ticket_id uuid not null references ticket (id),
    author_id uuid not null references user_account (id),
    body varchar(4000) not null check (length(btrim(body)) > 0),
    visibility varchar(16) not null check (visibility in ('PUBLIC', 'INTERNAL')),
    created_at timestamptz not null
);

create index ticket_comment_ticket_idx on ticket_comment (ticket_id, created_at, id);
create index ticket_comment_public_idx on ticket_comment (ticket_id, created_at, id) where visibility = 'PUBLIC';

create table ticket_event (
    id bigint generated always as identity primary key,
    ticket_id uuid not null references ticket (id),
    actor_id uuid not null references user_account (id),
    event_type varchar(32) not null check (event_type in (
        'CREATED', 'SLA_CONFIGURED', 'STATUS_CHANGED', 'RESOLVED', 'CLOSED', 'REOPENED',
        'PRIORITY_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'REASSIGNED', 'PUBLIC_COMMENT',
        'INTERNAL_COMMENT', 'FIRST_RESPONSE'
    )),
    occurred_at timestamptz not null,
    previous_value varchar(255),
    new_value varchar(255),
    metadata varchar(255)
);

create index ticket_event_history_idx on ticket_event (ticket_id, id);

create function reject_ticket_event_mutation() returns trigger language plpgsql as $$
begin
    raise exception 'Ticket history is append-only' using errcode = '55000';
end;
$$;

create trigger ticket_event_append_only
    before update or delete or truncate on ticket_event
    for each statement execute function reject_ticket_event_mutation();
