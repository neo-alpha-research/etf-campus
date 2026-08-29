"use client";

import { useEffect } from "react";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";

export function AppPushInitializer() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const registerPush = async () => {
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === "prompt") {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== "granted") {
        console.log("Push notification permission denied.");
        return;
      }

      await PushNotifications.register();

      // Listeners
      PushNotifications.addListener("registration", (token) => {
        console.log("Push registration success, token: " + token.value);
        // Here you would typically send the token to your backend/D1 database
      });

      PushNotifications.addListener("registrationError", (error: any) => {
        console.error("Error on registration: " + JSON.stringify(error));
      });

      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("Push received: " + JSON.stringify(notification));
      });

      PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
        console.log("Push action performed: " + JSON.stringify(notification));
      });
    };

    registerPush();
  }, []);

  return null;
}
