import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth/session';
import { queryAIService, checkPromptInjection } from '../../../lib/ai/gemini';
import { executeToolSecurely, toolsRegistry } from '../../../lib/tools/registry';
import { logAudit } from '../../../lib/security/audit';

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized. Session missing.' }, { status: 401 });
  }

  try {
    const { message, history = [], language = 'English', pendingAction } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 1. Prompt injection guard check
    if (checkPromptInjection(message)) {
      logAudit(session.userId, session.role, 'PROMPT_INJECTION_BLOCKED', undefined, false, `Message: ${message}`);
      return NextResponse.json({
        response: language === 'Hindi'
          ? 'सुरक्षा कारणों से, मैं आपके निर्देशों को ओवरराइड करने वाले अनुरोधों को स्वीकार नहीं कर सकता।'
          : 'For security reasons, I cannot process queries that attempt to modify my instructions.',
        intent: 'UNKNOWN',
        wantsToExecute: false,
        toolName: null,
        toolArgs: null,
        pendingAction: null
      });
    }

    // 2. Handle Action Confirmations
    if (pendingAction && pendingAction.status === 'awaiting_confirmation') {
      const confirmWord = message.toLowerCase().trim();
      const isConfirmed = ['yes', 'yeah', 'yep', 'confirm', 'proceed', 'haan', 'ha'].some(word => confirmWord.includes(word));
      const isCancelled = ['no', 'nope', 'cancel', 'na', 'nahi', 'nah'].some(word => confirmWord.includes(word));

      if (isConfirmed) {
        // Execute the pending action
        const { toolName, toolArgs } = pendingAction;
        const toolResult = await executeToolSecurely(toolName, toolArgs, session);

        if (toolResult.success) {
          let responseText = `Successfully executed action.`;
          if (toolName === 'markAttendance') {
            const studName = pendingAction.studentName || toolArgs.studentId;
            responseText = language === 'Hindi'
              ? `${studName} को आज के लिए अनुपस्थित चिह्नित कर दिया गया है।`
              : `${studName} has been marked absent for today.`;
          } else if (toolName === 'createTeacherCallRequest') {
            responseText = language === 'Hindi'
              ? `शिक्षक से बात करने का आपका अनुरोध दर्ज कर लिया गया है।`
              : `Your call request has been submitted to the teacher.`;
          } else if (toolName === 'createManagementSupportRequest') {
            responseText = language === 'Hindi'
              ? `आपका सहायता अनुरोध स्कूल प्रबंधन को भेज दिया गया है।`
              : `Your support request has been submitted to school management.`;
          }

          return NextResponse.json({
            response: responseText,
            intent: pendingAction.intent,
            wantsToExecute: false,
            toolName: null,
            toolArgs: null,
            toolResult,
            pendingAction: null // Clear pending action
          });
        } else {
          // Tool failed
          return NextResponse.json({
            response: language === 'Hindi'
              ? `क्षमा करें, मैं अनुरोध पूरा नहीं कर सका। विवरण: ${toolResult.error}`
              : `I'm sorry, I couldn't complete the action. Reason: ${toolResult.error}`,
            intent: pendingAction.intent,
            wantsToExecute: false,
            toolName: null,
            toolArgs: null,
            toolResult,
            pendingAction: null
          });
        }
      } else if (isCancelled) {
        return NextResponse.json({
          response: language === 'Hindi' ? 'कार्रवाई रद्द कर दी गई है।' : 'Action cancelled.',
          intent: 'UNKNOWN',
          wantsToExecute: false,
          toolName: null,
          toolArgs: null,
          pendingAction: null
        });
      } else {
        // Ambiguous message while confirmation is pending
        return NextResponse.json({
          response: language === 'Hindi'
            ? 'कृपया कार्रवाई की पुष्टि करें। क्या आप आगे बढ़ना चाहते हैं? (हाँ/नहीं)'
            : 'Please confirm the action. Would you like to proceed? (Yes/No)',
          intent: pendingAction.intent,
          wantsToExecute: false,
          toolName: null,
          toolArgs: null,
          pendingAction // Preserve the action
        });
      }
    }

    // 3. Normal AI query routing
    const aiOutput = await queryAIService(message, session, history, language);

    // 4. Handle tool execution recommendation from AI
    if (aiOutput.wantsToExecute && aiOutput.toolName) {
      const toolName = aiOutput.toolName;
      const toolArgs = aiOutput.toolArgs || {};

      // Determine if tool requires confirmation
      // markAttendance ALWAYS requires confirmation.
      // createTeacherCallRequest/createManagementSupportRequest can also require confirmation for parent safety.
      const requiresConfirmation = ['markAttendance', 'createTeacherCallRequest', 'createManagementSupportRequest'].includes(toolName);

      if (requiresConfirmation) {
        // Return confirmation request response
        let confirmationPrompt = `I can perform this action for you. Would you like to proceed?`;
        if (toolName === 'markAttendance') {
          const studName = aiOutput.entities?.studentName || toolArgs.studentId || 'the student';
          confirmationPrompt = language === 'Hindi'
            ? `क्या आप ${studName} को अनुपस्थित चिह्नित करना चाहते हैं? पुष्टि करने के लिए 'हाँ' कहें।`
            : `I can mark ${studName} absent for today. Would you like me to proceed?`;
        } else if (toolName === 'createTeacherCallRequest') {
          confirmationPrompt = language === 'Hindi'
            ? `क्या आप बच्चे के शिक्षक से कॉल का अनुरोध करना चाहते हैं?`
            : `I can request a call from your child's teacher. Would you like me to proceed?`;
        } else if (toolName === 'createManagementSupportRequest') {
          confirmationPrompt = language === 'Hindi'
            ? `क्या आप स्कूल प्रबंधन के लिए सहायता अनुरोध दर्ज करना चाहते हैं?`
            : `I can submit a support request to school management. Would you like me to proceed?`;
        }

        return NextResponse.json({
          response: confirmationPrompt,
          intent: aiOutput.intent,
          wantsToExecute: false,
          toolName: null,
          toolArgs: null,
          pendingAction: {
            status: 'awaiting_confirmation',
            toolName,
            toolArgs,
            intent: aiOutput.intent,
            studentName: aiOutput.entities?.studentName || null
          }
        });
      } else {
        // Execute immediately (e.g. read-only queries getStudentAttendance, getSchoolAttendance)
        const toolResult = await executeToolSecurely(toolName, toolArgs, session);
        
        // Re-inject tool result into conversational response if AI returned a generic loading text
        let finalResponse = aiOutput.response;
        if (toolResult.success) {
          if (toolName === 'getStudentAttendance' || toolName === 'getChildAttendance') {
            const studName = toolResult.studentName;
            const percent = toolResult.percentage;
            finalResponse = language === 'Hindi'
              ? `${studName} की वर्तमान उपस्थिति ${percent}% है। क्या आप चाहते हैं कि मैं हालिया उपस्थिति की भी जांच करूं?`
              : `${studName}'s current attendance is ${percent}%. Would you like me to check the recent attendance as well?`;
          } else if (toolName === 'getRecentAttendance') {
            const recordsList = toolResult.records.map((r: any) => `${r.date}: ${r.status === 'present' ? (language === 'Hindi' ? 'उपस्थित' : 'Present') : (language === 'Hindi' ? 'अनुपस्थित' : 'Absent')}`).join('\n');
            finalResponse = language === 'Hindi'
              ? `${toolResult.studentName} का हालिया उपस्थिति इतिहास:\n${recordsList}`
              : `Here are the recent attendance records for ${toolResult.studentName}:\n${recordsList}`;
          } else if (toolName === 'getSchoolAttendance') {
            const classAveragesText = toolResult.classAverages.map((c: any) => `${c.class}: ${c.percentage}%`).join(', ');
            finalResponse = language === 'Hindi'
              ? `स्कूल की कुल उपस्थिति ${toolResult.overallPercentage}% है। कक्षावार औसत: ${classAveragesText}`
              : `The school's overall attendance is currently ${toolResult.overallPercentage}%. Class-wise averages are: ${classAveragesText}`;
          }
        } else {
          finalResponse = language === 'Hindi'
            ? `क्षमा करें, मैं डेटा प्राप्त नहीं कर सका: ${toolResult.error}`
            : `I'm sorry, I couldn't retrieve that information: ${toolResult.error}`;
        }

        return NextResponse.json({
          response: finalResponse,
          intent: aiOutput.intent,
          wantsToExecute: false,
          toolName,
          toolArgs,
          toolResult,
          pendingAction: null
        });
      }
    }

    // Default chat output (e.g., FAQ, greetings, clarification)
    return NextResponse.json({
      response: aiOutput.response,
      intent: aiOutput.intent,
      wantsToExecute: false,
      toolName: null,
      toolArgs: null,
      pendingAction: aiOutput.clarificationNeeded ? {
        status: 'awaiting_clarification',
        message: aiOutput.clarificationNeeded
      } : null
    });

  } catch (error: any) {
    console.error('API Chat Orchestrator failure:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
