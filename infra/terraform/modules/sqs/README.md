# SQS queues

The root configuration uses this module twice:

| Queue | Producer | Consumer | Default visibility timeout |
| --- | --- | --- | --- |
| `${name_prefix}-ai-request` | Backend | AI server | 900 seconds |
| `${name_prefix}-ai-response` | AI server | Backend | 60 seconds |

Both queues are standard queues with SQS-managed encryption, four-day message
retention and 20-second long polling. Messages can be delivered more than once
and out of order; consumers must handle duplicate messages safely.

After applying the root configuration, run `terraform output -json ai_queues`
for queue names, URLs, ARNs and region. Application wiring and AWS identity
permissions are configured separately. No public queue access is granted.

Grant each producer `sqs:SendMessage` on its destination queue ARN. Grant each
consumer `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:ChangeMessageVisibility`,
`sqs:GetQueueAttributes` and `sqs:GetQueueUrl` on its source queue ARN.
Delete a message only after processing succeeds. Set the request visibility
timeout above the expected AI processing duration, or extend it during long
jobs using `ChangeMessageVisibility`. Configure the two root
`ai_*_visibility_timeout_seconds` variables to adjust these values.

Failed messages become visible again until retention expires; this module does
not configure dead-letter queues.
