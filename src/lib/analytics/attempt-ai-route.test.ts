import { beforeEach, describe, expect, it, vi } from "vitest";
import { scoreExam } from "../exams/scoring";
import { labExam, labResult } from "../exams/lab-exam.fixture";

const mocks = vi.hoisted(() => ({ actor: vi.fn(), attempt: vi.fn(), reserve: vi.fn(), chat: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({getAuthenticatedActor:mocks.actor,getStudentAttemptResult:mocks.attempt}));
vi.mock("../ai/service.server", () => ({withAIReservation:mocks.reserve}));
vi.mock("../ai/http.server", () => ({aiErrorResponse: () => Response.json({error:"quota_exhausted"},{status:429})}));
import { POST } from "../../app/api/attempts/[attemptId]/ai-review/route";

const attemptId="f19c83f5-a9e7-42f3-a2cf-69e65edfe8ba";
const context={params:Promise.resolve({attemptId})};
const hint={mode:"hint",locale:"vi",questionId:"lab-expression",level:1};
function request(payload: unknown) { return new Request("http://localhost/api/attempts/"+attemptId+"/ai-review",{method:"POST",body:JSON.stringify(payload)}); }
beforeEach(() => {
  vi.resetAllMocks();
  mocks.actor.mockResolvedValue({userId:"student-a"});
  mocks.attempt.mockResolvedValue(labResult({id:attemptId,examId:labExam.id,exam:{...labExam,questionCount:4},questions:[],status:"submitted",questionIdsInOrder:[],answers:{},startedAt:"2026-10-21T00:00:00Z",deadlineAt:null,submittedAt:"2026-10-21T00:01:00Z",durationSeconds:60,submitRequestId:"submit",result:scoreExam(labExam,{})}));
  mocks.chat.mockResolvedValue("Hãy rút gọn $\\sqrt{20}$.");
  mocks.reserve.mockImplementation(async (_type,_input,operation) => ({data:await operation({chat:mocks.chat}),quota:{kind:"account",remaining:4,limit:5,resetAt:null}}));
});
describe("submitted attempt AI boundary", () => {
  it.each([1,2,3])("routes hint level %i through existing credit reservation", async level => {
    const response=await POST(request({...hint,level}),context);
    expect(response.status).toBe(200);
    expect(mocks.attempt).toHaveBeenCalledWith("student-a",attemptId);
    expect(mocks.reserve).toHaveBeenCalledWith("chat","text",expect.any(Function));
    expect(mocks.chat).toHaveBeenCalledWith(expect.objectContaining({responseMode:"hint",hintLevel:level,groundedContext:expect.stringContaining("lab-expression")}));
  });
  it("passes conversational history and trusted result context", async () => {
    expect((await POST(request({mode:"chat",locale:"vi",questionIds:["lab-tf"],messages:[{role:"user",content:"Giải thích ý c"}]}),context)).status).toBe(200);
    expect(mocks.chat).toHaveBeenCalledWith(expect.objectContaining({responseMode:"chat",groundedContext:expect.stringContaining("descriptions_only")}));
  });
  it("rejects unauthenticated, foreign/missing attempts and unrelated questions before charging", async () => {
    mocks.actor.mockResolvedValueOnce(null);
    expect((await POST(request(hint),context)).status).toBe(401);
    mocks.attempt.mockResolvedValueOnce(null);
    expect((await POST(request(hint),context)).status).toBe(404);
    expect((await POST(request({...hint,questionId:"foreign-question"}),context)).status).toBe(404);
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON and non-user final messages", async () => {
    expect((await POST(new Request("http://localhost",{method:"POST",body:"{"}),context)).status).toBe(400);
    expect((await POST(request({mode:"chat",locale:"vi",questionIds:["lab-tf"],messages:[{role:"assistant",content:"wrong"}]}),context)).status).toBe(400);
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it("does not call the provider when quota reservation fails", async () => {
    mocks.reserve.mockRejectedValue(new Error("quota"));
    expect((await POST(request(hint),context)).status).toBe(429);
    expect(mocks.chat).not.toHaveBeenCalled();
  });
});
