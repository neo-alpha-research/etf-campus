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

      // Android 8.0+ 필수: 알림 채널 생성
      if (Capacitor.getPlatform() === "android") {
        await PushNotifications.createChannel({
          id: "fcm_default_channel",
          name: "기본 알림",
          description: "ETF Campus 시황 및 중요 공지 알림",
          importance: 5, // High importance (헤드업 팝업 표시)
          visibility: 1,
          vibration: true,
        });
      }

      await PushNotifications.register();

      // Listeners
      PushNotifications.addListener("registration", (token) => {
        console.log("==========================================");
        console.log("[FCM Push Token] " + token.value);
        console.log("==========================================");
        // 추후 이 토큰을 백엔드 DB(Cloudflare D1)로 저장하는 API 연동 예정
      });

      PushNotifications.addListener("registrationError", (error: any) => {
        console.error("[FCM Push Error] " + JSON.stringify(error));
      });

      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("[FCM Push Received]", notification);
      });

      PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
        console.log("[FCM Action Performed]", notification);
      });
    };

    registerPush();
  }, []);

  return null;
}
