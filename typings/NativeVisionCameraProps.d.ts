/**
 * This file was generated from NativeVisionCamera.xml
 * WARNING: All changes made to this file will be overwritten
 * @author Mendix Widgets Framework Team
 */
import { CSSProperties } from "react";
import { ActionValue, EditableValue } from "mendix";

export interface NativeVisionCameraProps<Style> {
    name: string;
    style: Style[];
    mediaPath: EditableValue<string>;
    onCaptureAction?: ActionValue;
}

export interface NativeVisionCameraPreviewProps {
    /**
     * @deprecated Deprecated since version 9.18.0. Please use class property instead.
     */
    className: string;
    class: string;
    style: string;
    styleObject?: CSSProperties;
    readOnly: boolean;
    mediaPath: string;
    onCaptureAction: {} | null;
}
