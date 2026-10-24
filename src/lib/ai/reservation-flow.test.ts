import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),chat:vi.fn(),readOwner:vi.fn(),createOwner:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("../supabase/admin",()=>({getSupabaseAdminClient:()=>({rpc:mocks.rpc})}));
vi.mock("../supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:{id:"student-a"}}})}})}));
vi.mock("../exams/guest-session.server",()=>({getOrCreateExamOwner:mocks.createOwner,readExamOwner:mocks.readOwner}));
vi.mock("./providers.server",()=>({getAIProvider:()=>({name:"openai",model:"test-provider",chat:mocks.chat})}));
import {withAIReservation,AIQuotaExhaustedError,readAIQuota} from "./service.server";
beforeEach(()=>{
  vi.resetAllMocks();
  mocks.rpc.mockImplementation(async(name)=>name==="reserve_ai_request"?{data:{kind:"account",plan:"free",unlimited:false,remaining:4,limit:5,resetAt:null,reservationId:"r",usageId:"u",requestId:"q"},error:null}:{data:null,error:null});
});
describe("existing AI credit lifecycle",()=>{
  it("does not create or replace a guest session during passive quota reads",async()=>{
    mocks.readOwner.mockResolvedValue(null);
    expect(await readAIQuota()).toMatchObject({kind:"guest",remaining:5,limit:5});
    expect(mocks.createOwner).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("reserves once and completes successful requests",async()=>{
    mocks.chat.mockResolvedValue("usable");
    expect((await withAIReservation("chat","text",p=>p.chat({locale:"vi",messages:[]}))).data).toBe("usable");
    expect(mocks.rpc.mock.calls.map(c=>c[0])).toEqual(["reserve_ai_request","finish_ai_request"]);
    expect(mocks.rpc).toHaveBeenLastCalledWith("finish_ai_request",expect.objectContaining({p_succeeded:true}));
  });
  it("requests refund through the same database RPC on provider failure",async()=>{
    mocks.chat.mockRejectedValue(new Error("provider failed"));
    await expect(withAIReservation("chat","text",p=>p.chat({locale:"vi",messages:[]}))).rejects.toThrow("provider failed");
    expect(mocks.rpc).toHaveBeenLastCalledWith("finish_ai_request",expect.objectContaining({p_succeeded:false}));
  });
  it("never calls the provider on quota exhaustion",async()=>{
    mocks.rpc.mockResolvedValue({error:{message:"ai_quota_exhausted"},data:null});
    await expect(withAIReservation("chat","text",p=>p.chat({locale:"vi",messages:[]}))).rejects.toBeInstanceOf(AIQuotaExhaustedError);
    expect(mocks.chat).not.toHaveBeenCalled();
  });
});
