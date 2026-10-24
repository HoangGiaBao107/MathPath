import type { ExamDefinition, PublicExamAttempt } from "./types";
import type { StudentAttemptResult } from "../analytics/types";

/** Original, rights-free QA fixture. Never included in the demo seeding array. */
export const labExam: ExamDefinition = {
  id: "mathpath-exam-lab", title: "MathPath · Kiểm thử chấm bài", description: "Dữ liệu tự tạo để kiểm thử, không phải đề NBV.",
  mode: "school_mock", demo: true, timingMode: "elapsed", durationSeconds: null, totalScore: 2.5,
  sections: [{id:"s1", title:"Trắc nghiệm",description:"",maxScore:0.5}, {id:"s2", title:"Đúng/sai",description:"",maxScore:1}, {id:"s3",title:"Biểu thức",description:"",maxScore:1}],
  questions: [
    {id:"lab-mc",sectionId:"s1",number:"1",type:"multiple_choice",stem:"Tính $2+3$.",points:0.5,topic:"Số học",options:[{key:"A",text:"$5$"},{key:"B",text:"$6$"},{key:"C",text:"$4$"},{key:"D",text:"$7$"}],correctOptionKey:"A"},
    {id:"lab-tf",sectionId:"s2",number:"2",type:"true_false",stem:"Xét hàm số $y=x^2$.",points:1,topic:"Hàm số",statements:[{key:"a",text:"$f(0)=0$."},{key:"b",text:"$f(1)=1$."},{key:"c",text:"$f(-1)=-1$."},{key:"d",text:"Đồ thị đối xứng qua trục tung."}],correctStatements:{a:true,b:true,c:false,d:true},scoring:{kind:"partial",pointsByCorrectCount:[0,0.1,0.25,0.5,1]}},
    {id:"lab-expression",sectionId:"s3",number:"3",type:"short_answer",stem:"Rút gọn $\\sqrt{20}/2$.",points:0.5,topic:"Căn thức",canonicalAnswer:"sqrt(5)",inputPolicy:{kind:"expression",maxLength:128}},
    {id:"lab-pi",sectionId:"s3",number:"4",type:"short_answer",stem:"Tính chính xác $\\pi/2-2/3$.",points:0.5,topic:"Biểu thức",canonicalAnswer:"(3*pi-4)/6",inputPolicy:{kind:"expression",maxLength:128}},
  ],
};
export function isExamLabEnabled() {
  return process.env.NODE_ENV === "development" && process.env.MATHPATH_EXAM_LAB === "1" && process.env.MATHPATH_ATTEMPT_STORE === "mock";
}
export function labResult(attempt: PublicExamAttempt): StudentAttemptResult | null {
  if (!attempt.result || !attempt.submittedAt || !["submitted","auto_submitted"].includes(attempt.status) || attempt.examId !== labExam.id) return null;
  const explanations = ["$2+3=5$.", "Thay $x=0,1,-1$ vào $f(x)=x^2$. Vì $(-x)^2=x^2$ nên hàm số chẵn.", "$\\sqrt{20}=2\\sqrt{5}$, do đó $\\sqrt{20}/2=\\sqrt{5}$.", "Quy đồng mẫu số: $\\pi/2-2/3=(3\\pi-4)/6$."];
  return {
    attemptId:attempt.id,examSlug:labExam.id,examTitle:labExam.title,submittedAt:attempt.submittedAt,durationSeconds:attempt.durationSeconds,status:attempt.status as "submitted" | "auto_submitted",
    result:{...attempt.result, questionOutcomes:attempt.result.questionOutcomes.map((outcome,index) => {
      const q=labExam.questions[index];
      return {...outcome,review:{questionType:q.type,statement:q.stem,options:q.type==="multiple_choice"?q.options:[],substatements:q.type==="true_false"?q.statements:[],
        assets:q.id==="lab-tf"?[{path:"/problem-assets/mathpath-fixture-parabola.svg",altText:"Đồ thị y = x², đỉnh O(0,0), qua (−1,1) và (1,1).",placement:"stem"}]:[],
        selectedAnswer:attempt.answers[q.id]?.answer as Record<string,unknown> | null,
        correctAnswer:q.type==="multiple_choice"?{option_key:q.correctOptionKey}:q.type==="true_false"?{statements:q.correctStatements}:{accepted_values:[q.id==="lab-pi"?"\\frac{3\\pi-4}{6}":"\\sqrt{5}"],input_policy:q.inputPolicy},explanation:explanations[index]}};
    })},
  };
}
