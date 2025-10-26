export class AlertSystem {
  private static instance: AlertSystem;
  private alertContainer: HTMLDivElement;
  private activeAlerts: Map<string, { element: HTMLDivElement; timeout: NodeJS.Timeout }> =
    new Map();

  private constructor() {
    this.alertContainer = document.getElementById('alert-container') as HTMLDivElement;
    if (!this.alertContainer) {
      this.alertContainer = document.createElement('div');
      this.alertContainer.id = 'alert-container';
      document.body.appendChild(this.alertContainer);
    }
  }

  public static getInstance(): AlertSystem {
    if (!AlertSystem.instance) {
      AlertSystem.instance = new AlertSystem();
    }
    return AlertSystem.instance;
  }

  public showAlert(
    message: string,
    type: 'error' | 'warning' | 'info' | 'success' = 'error'
  ): void {
    const alertKey = `${message}-${type}`;

    if (this.activeAlerts.has(alertKey)) {
      const existing = this.activeAlerts.get(alertKey);
      if (existing) {
        clearTimeout(existing.timeout);
        existing.timeout = setTimeout(() => this.removeAlert(alertKey), 5000);
      }
      return;
    }

    const alertElement = document.createElement('div');
    alertElement.className = `alert-msg ${type}`;
    alertElement.textContent = message;

    const removeThisAlert = () => {
      this.removeAlert(alertKey);
    };

    alertElement.addEventListener('click', removeThisAlert);

    const timeout = setTimeout(removeThisAlert, 10000);

    // Store both the element and timeout so we can manage them
    this.activeAlerts.set(alertKey, {
      element: alertElement,
      timeout: timeout,
    });

    this.alertContainer.appendChild(alertElement);
  }

  private removeAlert(alertKey: string): void {
    const alertData = this.activeAlerts.get(alertKey);
    if (alertData) {
      clearTimeout(alertData.timeout);
      alertData.element.classList.add('fade-out');

      setTimeout(() => {
        if (alertData.element.parentNode) {
          alertData.element.parentNode.removeChild(alertData.element);
        }
        this.activeAlerts.delete(alertKey);
      }, 300);
    }
  }

  public clearAll(): void {
    for (const [alertKey, alertData] of this.activeAlerts.entries()) {
      clearTimeout(alertData.timeout);
      if (alertData.element.parentNode) {
        alertData.element.parentNode.removeChild(alertData.element);
      }
    }
    this.activeAlerts.clear();
  }

  public removeAlertByMessage(
    message: string,
    type?: 'error' | 'warning' | 'info' | 'success'
  ): void {
    if (type) {
      const alertKey = `${message}-${type}`;
      this.removeAlert(alertKey);
    } else {
      for (const alertKey of this.activeAlerts.keys()) {
        if (alertKey.startsWith(message + '-')) {
          this.removeAlert(alertKey);
        }
      }
    }
  }
}

export function showAlert(message: string, type?: 'error' | 'warning' | 'info' | 'success'): void {
  AlertSystem.getInstance().showAlert(message, type);
}

export function clearAllAlerts(): void {
  AlertSystem.getInstance().clearAll();
}

export function removeAlert(
  message: string,
  type?: 'error' | 'warning' | 'info' | 'success'
): void {
  AlertSystem.getInstance().removeAlertByMessage(message, type);
}
