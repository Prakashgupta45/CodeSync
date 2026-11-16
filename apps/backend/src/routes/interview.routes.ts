import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { interviewController } from '../controllers/interview.controller';

const router = Router();

// Public / Candidate endpoints (candidate token validation, AI interaction & submission recording)
router.get('/token/:token', (req, res, next) => interviewController.getCandidateInterview(req, res, next));
router.get('/token/:token/ai', (req, res, next) => interviewController.getCandidateAiHistory(req, res, next));
router.post('/token/:token/ai', (req, res, next) => interviewController.promptCandidateAi(req, res, next));
router.post('/token/:token/record-submission', (req, res, next) => interviewController.recordSubmission(req, res, next));

// Authenticated HR endpoints (enforcing JWT cookie / session ownership)
router.use(authenticateToken);

router.get('/', (req, res, next) => interviewController.getUserInterviews(req, res, next));
router.post('/portal', (req, res, next) => interviewController.createPortalInterview(req, res, next));
router.get('/problems', (req, res, next) => interviewController.getProblems(req, res, next));
router.post('/', (req, res, next) => {
  if (req.body && req.body.role && req.body.candidateName && req.body.problems) {
    return interviewController.createPortalInterview(req, res, next);
  }
  return interviewController.createInterview(req, res, next);
});
router.get('/room/:roomId', (req, res, next) => interviewController.getInterviewByRoomId(req, res, next));
router.get('/:interviewId/report', (req, res, next) => interviewController.getInterviewReport(req, res, next));
router.get('/:interviewId', (req, res, next) => interviewController.getInterviewById(req, res, next));
router.patch('/:interviewId', (req, res, next) => interviewController.updateInterview(req, res, next));
router.post('/:interviewId/start', (req, res, next) => interviewController.startInterview(req, res, next));
router.post('/message', (req, res, next) => interviewController.sendMessage(req, res, next));
router.post('/complete', (req, res, next) => interviewController.completeInterview(req, res, next));

export default router;
