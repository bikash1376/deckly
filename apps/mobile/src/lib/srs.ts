/**
 * The SM-2 scheduler lives in @retenit/shared so the app's predicted intervals
 * and the server's written ones come from one implementation. Re-exported here
 * so app code keeps importing from `@/lib/srs`.
 */
export {
  schedule,
  describeInterval,
  previewGrades,
  INITIAL_SRS,
  type SrsState,
} from "@retenit/shared";
