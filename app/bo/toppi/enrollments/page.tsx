import { PageHeading, PrototypeBanner } from "../components";
import styles from "../toppi-bo.module.css";
import EnrollmentPrototype from "./EnrollmentPrototype";

export default function ToppiEnrollmentsPage() {
  return (
    <div className={styles.page}>
      <PrototypeBanner />
      <PageHeading
        title="Enrollments"
        subtitle="Manage the learner’s Program × Level relationship, 12-unit package, schedule placement and renewal continuity."
      />
      <EnrollmentPrototype />
    </div>
  );
}
