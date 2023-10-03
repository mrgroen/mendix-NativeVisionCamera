import { ReactElement, createElement, useState, useEffect, Fragment } from "react";
import { TextStyle, ViewStyle } from "react-native";
import { Camera, CameraPermissionStatus } from "react-native-vision-camera";

import { Style } from "@mendix/pluggable-widgets-tools";

import { CameraPage } from "./components/CameraPage";
import { NativeVisionCameraProps } from "../typings/NativeVisionCameraProps";

export interface CustomStyle extends Style {
    container: ViewStyle;
    label: TextStyle;
}

export function NativeVisionCamera(props: NativeVisionCameraProps<CustomStyle>): ReactElement {
    const [cameraPermission, setCameraPermission] = useState<CameraPermissionStatus>();
    const [microphonePermission, setMicrophonePermission] = useState<CameraPermissionStatus>();

    useEffect(() => {
        Camera.getCameraPermissionStatus().then(setCameraPermission);
        Camera.getMicrophonePermissionStatus().then(setMicrophonePermission);
    }, []);

    console.log(`Re-rendering. Camera: ${cameraPermission} | Microphone: ${microphonePermission}`);

    if (cameraPermission == null || microphonePermission == null) {
        // still loading
        return <Fragment></Fragment>;
    }

    return <CameraPage
                mediaPath={props.mediaPath}
                onCaptureAction={props.onCaptureAction}
            />;
}
