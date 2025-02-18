import React, { createElement, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { ActionValue, DynamicValue, EditableValue, ValueStatus } from "mendix";
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  CameraRuntimeError,
  PhotoFile,
  VideoFile,
  TakePhotoOptions,
  TakeSnapshotOptions,
  useLocationPermission
} from 'react-native-vision-camera';
import { CONTENT_SPACING, SAFE_AREA_PADDING, BUTTON_SIZE, BUTTON_ICON_SIZE, CAPTURE_BUTTON_SIZE, SCREEN_HEIGHT, SCREEN_WIDTH } from '../Constants';
import { useIsForeground } from '../hooks/useIsForeground';
import { useIsFocused } from '@react-navigation/core';
import { usePreferredCameraDevice } from '../hooks/usePreferredCameraDevice';
import { StatusBarBlurBackground } from './StatusBarBlurBackground';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import IonIcon from 'react-native-vector-icons/Ionicons';

type CameraPageProps = {
  mediaPath: EditableValue<string>;
  onCaptureAction?: ActionValue;
};

export const executeAction = (action?: ActionValue): void => {
  if (action && action.canExecute && !action.isExecuting) {
      action.execute();
  }
};

export const isAvailable = (property: DynamicValue<any> | EditableValue<any>): boolean => {
  return property && property.status === ValueStatus.Available && property.value;
};

export function CameraPage({ mediaPath, onCaptureAction }: CameraPageProps): React.ReactElement {
  const camera = useRef<Camera>(null);
  const location = useLocationPermission();
  let zoom = { value: 1.0 };

  // check if camera page is active
  const isFocussed = useIsFocused()
  const isForeground = useIsForeground();
  const isActive = isFocussed && isForeground;

  // set states
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back');
  const [enableHdr, setEnableHdr] = useState(false);
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [enableNightMode, setEnableNightMode] = useState(false);

  // check orientation
  const determineAndSetOrientation = () => {
    if (SCREEN_WIDTH < SCREEN_HEIGHT) {
      setOrientation('portrait');
    } else {
      setOrientation('landscape');
    }
  }

  // camera device settings
  const [preferredDevice] = usePreferredCameraDevice()
  let device = useCameraDevice(cameraPosition)

  if (preferredDevice != null && preferredDevice.position === cameraPosition) {
    // override default device with the one selected by the user in settings
    device = preferredDevice
  }
  const [targetFps, setTargetFps] = useState(60)
  const screenAspectRatio = SCREEN_HEIGHT / SCREEN_WIDTH
  const format = useCameraFormat(device, [
    { fps: targetFps },
    { videoAspectRatio: screenAspectRatio },
    { videoResolution: 'max' },
    { photoAspectRatio: screenAspectRatio },
    { photoResolution: 'max' },
  ])
  const fps = Math.min(format?.maxFps ?? 1, targetFps)
  const supportsCameraFlipping = true;
  const supportsFlash = device?.hasFlash ?? false;
  const supportsHdr = format?.supportsPhotoHdr;
  const supports60Fps = useMemo(() => device?.formats.some((f: any) => f.maxFps >= 60), [device?.formats])
  const canToggleNightMode = device?.supportsLowLightBoost ?? false;
  const takePhotoOptions = useMemo<TakePhotoOptions & TakeSnapshotOptions>(
    () => ({
      flash: flash,
      quality: 90,
      enableAutoStabilization: true,
      enableShutterSound: true
    }),
    [flash]
  );

  //#region Callbacks
  const onError = useCallback((error: CameraRuntimeError) => {
    console.error(error);
  }, []);
  const onInitialized = useCallback(() => {
    console.log('Camera initialized!');
  }, []);
  const onMediaCaptured = useCallback(
    (media: PhotoFile | VideoFile, type: 'photo' | 'video') => {
      console.log(`Media captured! ${JSON.stringify(media)}`);
      console.log(`type = ${JSON.stringify(type)}`);
      try {
        console.log(`setting media path to ${media.path}`);
        mediaPath.setValue(`${media.path}`);
      } catch (e) {
        console.error('Failed to set media path!', e);
      }
      try {
        executeAction(onCaptureAction);
      } catch (e) {
        console.error('Failed to execute onCaptureAction!', e);
      }
    }, [mediaPath, onCaptureAction]);
  const onFlipCameraPressed = useCallback(() => {
    setCameraPosition((p) => (p === 'back' ? 'front' : 'back'));
  }, []);
  const onFlashPressed = useCallback(() => {
    setFlash((f) => (f === 'off' ? 'on' : 'off'));
  }, []);
  const onCapturePressed = useCallback(async () => {
    try {
      if (camera.current == null) throw new Error('Camera ref is null!');
      console.log('Taking photo...');
      const photo = await camera.current.takePhoto(takePhotoOptions);
      onMediaCaptured(photo, 'photo');
    } catch (e) {
      console.error('Failed to take photo!', e);
    }
  }, [camera, onMediaCaptured, takePhotoOptions]);
  //#endregion

  //#region Effects
  useEffect(() => {
    // Reset zoom to it's default everytime the `device` changes.
    zoom.value = device?.neutralZoom ?? 1;
  }, [zoom, device]);

  useEffect(() => {
    location.requestPermission();
  }, [location]);

  useEffect(() => {
    determineAndSetOrientation();
    const subscription = Dimensions.addEventListener('change', determineAndSetOrientation);
    return () => subscription?.remove();
  }, []);
  //#endregion

  const photoHdr = format?.supportsPhotoHdr && enableHdr;

  const dynamicStyles = (orientation == 'landscape') ? StyleSheet.create({
    captureButtonRing: {
      alignSelf: 'flex-end',
      right: SAFE_AREA_PADDING.paddingBottom
    }
  }) : StyleSheet.create({ captureButtonRing: {} });

  return (
    <View style={styles.container}>
      {device != null ? (
        <Camera
          ref={camera}
          style={[StyleSheet.absoluteFill]}
          device={device}
          isActive={isActive}
          enableDepthData={true}
          enableLocation={location.hasPermission}
          enableZoomGesture={true}
          exposure={0}
          format={format}
          fps={fps}
          lowLightBoost={device.supportsLowLightBoost && enableNightMode}
          zoom={zoom.value}
          onInitialized={onInitialized}
          onError={onError}
          onStarted={() => console.log('Camera started!')}
          onStopped={() => console.log('Camera stopped!')}
          onPreviewStarted={() => console.log('Preview started!')}
          onPreviewStopped={() => console.log('Preview stopped!')}
          onOutputOrientationChanged={(o) => console.log(`Output orientation changed to ${o}!`)}
          onPreviewOrientationChanged={(o) => console.log(`Preview orientation changed to ${o}!`)}
          onUIRotationChanged={(degrees) => console.log(`UI Rotation changed: ${degrees}°`)}
          outputOrientation="device"
          photo={true}
          photoHdr={photoHdr}
          video={false}
          videoHdr={false}
          audio={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.text}>No camera found.</Text>
        </View>
      )}

      <StatusBarBlurBackground />

      <View style={styles.rightButtonRow}>
        {supportsCameraFlipping && (
          <TouchableOpacity style={styles.button} onPress={onFlipCameraPressed}>
            <IonIcon name="camera-reverse" color="white" size={BUTTON_ICON_SIZE} />
          </TouchableOpacity>
        )}
        {supportsFlash && (
          <TouchableOpacity style={styles.button} onPress={onFlashPressed}>
            <IonIcon name={flash === 'on' ? 'flash' : 'flash-off'} color="white" size={BUTTON_ICON_SIZE} />
          </TouchableOpacity>
        )}
        {supports60Fps && (
          <TouchableOpacity style={styles.button} onPress={() => setTargetFps((t) => (t === 30 ? 60 : 30))}>
            <Text style={styles.text}>{`${targetFps}\nFPS`}</Text>
          </TouchableOpacity>
        )}
        {supportsHdr && (
          <TouchableOpacity style={styles.button} onPress={() => setEnableHdr((h) => !h)}>
            <MaterialIcon name={enableHdr ? 'hdr' : 'hdr-off'} color="white" size={BUTTON_ICON_SIZE} />
          </TouchableOpacity>
        )}
        {canToggleNightMode && (
          <TouchableOpacity style={styles.button} onPress={() => setEnableNightMode(!enableNightMode)}>
            <IonIcon name={enableNightMode ? 'moon' : 'moon-outline'} color="white" size={BUTTON_ICON_SIZE} />
          </TouchableOpacity>
        )}
      </View>

      {device != null && (
        <View style={[styles.captureButtonRing, dynamicStyles.captureButtonRing]}>
          <TouchableOpacity style={styles.captureButton} onPress={onCapturePressed} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black'
  },
  captureButtonRing: {
    justifyContent: 'center',
    position: 'absolute',
    alignSelf: 'center',
    bottom: SAFE_AREA_PADDING.paddingBottom,
    padding: 2,
    width: CAPTURE_BUTTON_SIZE,
    height: CAPTURE_BUTTON_SIZE,
    borderRadius: CAPTURE_BUTTON_SIZE / 2,
    borderWidth: 4,
    borderColor: 'white'
  },
  captureButton: {
    flex: 1,
    borderRadius: CAPTURE_BUTTON_SIZE / 2,
    backgroundColor: 'white'
  },
  button: {
    marginBottom: CONTENT_SPACING,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: 'rgba(140, 140, 140, 0.3)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  rightButtonRow: {
    position: 'absolute',
    right: SAFE_AREA_PADDING.paddingRight,
    top: SAFE_AREA_PADDING.paddingTop
  },
  text: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});