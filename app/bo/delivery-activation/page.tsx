import { DeliveryActivationView } from "./DeliveryActivationView";
import styles from "./delivery-feedback.module.css";

export default function DeliveryActivationPage() {
  return (
    <div className={styles.actionFeedbackRoot}>
      <DeliveryActivationView />
    </div>
  );
}
