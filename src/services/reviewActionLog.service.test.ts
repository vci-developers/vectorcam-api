import ReviewActionLog from '../db/models/ReviewActionLog';
import { logReviewAction } from './reviewActionLog.service';

jest.mock('../db/models/ReviewActionLog', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
  },
}));

describe('logReviewAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores collectionCycleId at the top level', async () => {
    await logReviewAction({
      siteId: 42,
      year: 2025,
      month: 6,
      action: 'certify_session',
      userId: 7,
      collectionCycleId: 12,
      fields: {
        endpoint: '/sessions/:session_id',
      },
    });

    expect(ReviewActionLog.create).toHaveBeenCalledWith({
      siteId: 42,
      year: 2025,
      month: 6,
      action: 'certify_session',
      userId: 7,
      collectionCycleId: 12,
      hasChanges: false,
      changes: null,
      fields: {
        endpoint: '/sessions/:session_id',
      },
      metadata: null,
    });
  });

  it('stores null collectionCycleId when unassigned', async () => {
    await logReviewAction({
      siteId: 42,
      year: 2025,
      month: 6,
      action: 'update_session_household_info',
      userId: 7,
    });

    expect(ReviewActionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionCycleId: null,
      })
    );
  });
});
