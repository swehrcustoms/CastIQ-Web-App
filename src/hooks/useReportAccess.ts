import { useAuth } from './useAuth';
import { canSeeReportDetail } from '../subscriptions/entitlements';
import { tierForViewer } from '../subscriptions/staffAccess';

/** True when this signed-in account may see lure, depth, structure, written reports, and tactics. */
export function useReportAccess(): boolean {
  const { user } = useAuth();
  return canSeeReportDetail(tierForViewer(user?.email));
}
