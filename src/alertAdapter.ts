/**
 * Alert Adapter Module
 *
 * Provides a cross-platform alert service for displaying update dialogs.
 * Handles platform-specific differences between iOS and Android.
 *
 * @module alertAdapter
 */

import { Alert as RNAlert, Platform, NativeModules } from 'react-native';
import type { AlertService, DialogButton } from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_ANDROID_BUTTONS = 2;

// =============================================================================
// TYPES
// =============================================================================

interface CodePushDialogModule {
  showDialog(
    title: string,
    message: string,
    button1Text: string | null,
    button2Text: string | null,
    onSuccess: (buttonId: number) => void,
    onError: (error: Error) => void
  ): void;
}

// =============================================================================
// ANDROID ALERT IMPLEMENTATION
// =============================================================================

/**
 * Creates an Android-specific alert service using the native CodePushDialog module.
 */
function createAndroidAlertService(): AlertService {
  const CodePushDialog = NativeModules['CodePushDialog'] as CodePushDialogModule | undefined;

  if (!CodePushDialog) {
    // Fallback to React Native Alert if native module is not available
    return createDefaultAlertService();
  }

  return {
    alert(title: string, message: string, buttons: DialogButton[]): void {
      if (buttons.length > MAX_ANDROID_BUTTONS) {
        throw new Error(`Cannot show more than ${MAX_ANDROID_BUTTONS} buttons for Android dialog.`);
      }

      const button1Text = buttons[0]?.text ?? null;
      const button2Text = buttons[1]?.text ?? null;

      const handleButtonPress = (buttonId: number): void => {
        const button = buttons[buttonId];
        button?.onPress?.();
      };

      const handleError = (error: Error): void => {
        throw error;
      };

      CodePushDialog.showDialog(title, message, button1Text, button2Text, handleButtonPress, handleError);
    },
  };
}

// =============================================================================
// DEFAULT ALERT IMPLEMENTATION
// =============================================================================

/**
 * Creates the default alert service using React Native's Alert component.
 */
function createDefaultAlertService(): AlertService {
  return {
    alert(title: string, message: string, buttons: DialogButton[]): void {
      RNAlert.alert(title, message, buttons);
    },
  };
}

// =============================================================================
// ALERT SERVICE FACTORY
// =============================================================================

/**
 * Creates the appropriate alert service based on the current platform.
 */
function createAlertService(): AlertService {
  if (Platform.OS === 'android') {
    return createAndroidAlertService();
  }
  return createDefaultAlertService();
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Platform-appropriate alert service instance.
 */
export const Alert: AlertService = createAlertService();

export default Alert;
