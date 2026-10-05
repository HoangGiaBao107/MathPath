# Route architecture

The App Router is organized by product area. Route groups are organizational and do not add URL segments.

| URL                                               | Purpose                                     | Phase       |
| ------------------------------------------------- | ------------------------------------------- | ----------- |
| `/`                                               | Home and score-goal onboarding              | 2           |
| `/problems`                                       | Problem bank catalogue                      | 3           |
| `/exams/[examId]`                                 | Mock exam intro and active exam attempt      | 4           |
| `/auth/login`, `/auth/register`, `/auth/recovery` | Supabase Auth flows                          | 5           |
| `/auth/callback`                                  | OAuth/email recovery callback                | 5           |
| `/account`                                        | Authenticated profile summary/sign out       | 5           |
| `/results/[attemptId]`                            | Score and answer review                     | 4–5         |
| `/progress`                                       | Student progress dashboard                  | 6           |
| `/ai`                                             | Text/image solver                           | 9–10        |
| `/ai/practice/[practiceId]`                       | AI-generated similar practice               | 11          |
| `/auth/login`, `/auth/register`, `/auth/recovery` | Authentication flows                        | 7–8         |
| `/account`, `/account/usage`, `/account/settings` | Profile and usage                           | 7+          |
| `/pricing`, `/payments/[orderId]`                 | Configured offer and payment status         | 12–13       |
| `/feedback`                                       | Feedback form                               | 14          |
| `/admin/**`                                       | Role-protected content and operations tools | Later phase |

Exam attempt endpoints exist at `POST /api/attempts`, `GET /api/attempts?examId=...`, `GET/PATCH /api/attempts/[attemptId]`, and `POST /api/attempts/[attemptId]/submit`. They validate at the boundary and call `AttemptRepository`; explicit local mock mode uses the development store, while Supabase mode uses durable server-only RPCs and production fails closed without configuration. Auth endpoints live under `/api/auth/[action]`. AI, payments, feedback, and admin API groups remain out of scope.
