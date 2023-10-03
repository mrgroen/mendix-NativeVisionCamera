import React, { createElement, useRef, useState, useMemo, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { ActionValue, EditableValue } from "mendix";
import {
  Camera,
  frameRateIncluded,
  CameraDeviceFormat,
  CameraRuntimeError,
  FrameProcessorPerformanceSuggestion,
  PhotoFile,
  sortFormats,
  useCameraDevices,
  VideoFile,
  TakePhotoOptions,
  TakeSnapshotOptions
} from 'react-native-vision-camera';
import { CONTENT_SPACING, MAX_ZOOM_FACTOR, SAFE_AREA_PADDING, BUTTON_SIZE, BUTTON_ICON_SIZE, CAPTURE_BUTTON_SIZE } from '../Constants';
import { useEffect } from 'react';
import { useIsForeground } from '../hooks/useIsForeground';
import { StatusBarBlurBackground } from './StatusBarBlurBackground';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import IonIcon from 'react-native-vector-icons/Ionicons';

type CameraPageProps = {
  mediaPath: EditableValue<string>;
  onCaptureAction?: ActionValue;
};

export function CameraPage({ mediaPath, onCaptureAction }: CameraPageProps): React.ReactElement {
  const camera = useRef<Camera>(null);
  const zoom = { value: 1.0 };
  const isPressingButton = { value: false };

  // check if camera page is active
  const isForeground = useIsForeground();
  const isActive = isForeground;

  // set states
  const [isCameraInitialized, setIsCameraInitialized] = useState(false);
  const [hasMicrophonePermission, setHasMicrophonePermission] = useState(false);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back');
  const [enableHdr, setEnableHdr] = useState(false);
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [enableNightMode, setEnableNightMode] = useState(false);

  // check orientation
  const determineAndSetOrientation = () => {
    let width = Dimensions.get('window').width;
    let height = Dimensions.get('window').height;
    if (width < height) {
      setOrientation('portrait');
    } else {
      setOrientation('landscape');
    }
  }

  // camera format settings
  const devices = useCameraDevices();
  const device = devices[cameraPosition];
  const formats = useMemo<CameraDeviceFormat[]>(() => {
    if (device?.formats == null) return [];
    return device.formats.sort(sortFormats);
  }, [device?.formats]);

  //#region Memos
  const [is60Fps, setIs60Fps] = useState(false);
  const fps = useMemo(() => {
    if (!is60Fps) return 30;

    if (enableNightMode && !device?.supportsLowLightBoost) {
      // User has enabled Night Mode, but Night Mode is not natively supported, so we simulate it by lowering the frame rate.
      return 30;
    }

    const supportsHdrAt60Fps = formats.some((f) => f.supportsVideoHDR && f.frameRateRanges.some((r) => frameRateIncluded(r, 60)));
    if (enableHdr && !supportsHdrAt60Fps) {
      // User has enabled HDR, but HDR is not supported at 60 FPS.
      return 30;
    }

    const supports60Fps = formats.some((f) => f.frameRateRanges.some((r) => frameRateIncluded(r, 60)));
    if (!supports60Fps) {
      // 60 FPS is not supported by any format.
      return 30;
    }
    // We default to 30 FPS.
    return 30;
  }, [device?.supportsLowLightBoost, enableHdr, enableNightMode, formats, is60Fps]);

  const supportsCameraFlipping = useMemo(() => devices.back != null && devices.front != null, [devices.back, devices.front]);
  const supportsFlash = device?.hasFlash ?? false;
  const supportsHdr = useMemo(() => formats.some((f) => f.supportsVideoHDR || f.supportsPhotoHDR), [formats]);
  const supports60Fps = useMemo(() => formats.some((f) => f.frameRateRanges.some((rate) => frameRateIncluded(rate, 60))), [formats]);
  const takePhotoOptions = useMemo<TakePhotoOptions & TakeSnapshotOptions>(
    () => ({
      flash: flash,
      quality: 90,
      enableAutoStabilization: true
    }),
    [flash]
  );
  const canToggleNightMode = enableNightMode
    ? true // it's enabled so you have to be able to turn it off again
    : (device?.supportsLowLightBoost ?? false) || fps > 30; // either we have native support, or we can lower the FPS
  //#endregion

  const format = useMemo(() => {
    let result = formats;
    if (enableHdr) {
      // We only filter by HDR capable formats if HDR is set to true.
      // Otherwise we ignore the `supportsVideoHDR` property and accept formats which support HDR `true` or `false`
      result = result.filter((f) => f.supportsVideoHDR || f.supportsPhotoHDR);
    }

    // find the first format that includes the given FPS
    return result.find((f) => f.frameRateRanges.some((r) => frameRateIncluded(r, fps)));
  }, [formats, fps, enableHdr]);

  //#region Animated Zoom
  // This just maps the zoom factor to a percentage value.
  // so e.g. for [min, neutr., max] values [1, 2, 128] this would result in [0, 0.0081, 1]
  const minZoom = device?.minZoom ?? 1;
  const maxZoom = Math.min(device?.maxZoom ?? 1, MAX_ZOOM_FACTOR);
  //#endregion

  //#region Callbacks
  const setIsPressingButton = useCallback(
    (_isPressingButton: boolean) => {
      isPressingButton.value = _isPressingButton;
    },
    [isPressingButton],
  );
  // Camera callbacks
  const onError = useCallback((error: CameraRuntimeError) => {
    console.error(error);
  }, []);
  const onInitialized = useCallback(() => {
    console.log('Camera initialized!');
    setIsCameraInitialized(true);
  }, []);
  const onMediaCaptured = useCallback(
    (media: PhotoFile | VideoFile, type: 'photo' | 'video') => {
      console.log(`Media captured! ${JSON.stringify(media)}`);
      console.log(`type = ${JSON.stringify(type)}`);
      if (mediaPath) {
        if (mediaPath.status !== "available") return;
        mediaPath.setValue(`${media.path}`);
        if (onCaptureAction && onCaptureAction.canExecute && !onCaptureAction.isExecuting) {
          onCaptureAction.execute();
        }
      }
    }, []);
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
  const neutralZoom = device?.neutralZoom ?? 1;
  useEffect(() => {
    // Run everytime the neutralZoomScaled value changes. (reset zoom when device changes)
    zoom.value = neutralZoom;
  }, [neutralZoom, zoom]);

  useEffect(() => {
    Camera.getMicrophonePermissionStatus().then((status) => setHasMicrophonePermission(status === 'authorized'));
  }, []);

  useEffect(() => {
    determineAndSetOrientation();
    const subscription = Dimensions.addEventListener('change', determineAndSetOrientation);
    return () => subscription?.remove();
  }, []);
  //#endregion

  if (device != null && format != null) {
    console.log(
      `Re-rendering camera page with ${isActive ? 'active' : 'inactive'} camera. ` +
      `Device: "${device.name}" Format: ${format.photoWidth}x${format.photoHeight} @ ${fps}fps ` + 
      `(${format})`
    );
    console.log(isCameraInitialized ? 'Camera is initialized' : 'Camera is not initialized');
    console.log(minZoom);
    console.log(maxZoom);
    console.log(onMediaCaptured);
    console.log(setIsPressingButton);

  } else {
    console.log('re-rendering camera page without active camera');
  }

  const onFrameProcessorSuggestionAvailable = useCallback((suggestion: FrameProcessorPerformanceSuggestion) => {
    console.log(`Suggestion available! ${suggestion.type}: Can do ${suggestion.suggestedFrameProcessorFps} FPS`);
  }, []);

  const dynamicStyles = (orientation == 'landscape') ? StyleSheet.create({
    captureButtonRing: {
      alignSelf: 'flex-end',
      right: SAFE_AREA_PADDING.paddingBottom
    }
  }) : StyleSheet.create({ captureButtonRing: {} });

  return (
    <View style={styles.container}>
      {device != null && (
        <Camera
          ref={camera}
          style={[StyleSheet.absoluteFill]}
          device={device}
          fps={fps}
          hdr={enableHdr}
          lowLightBoost={device.supportsLowLightBoost && enableNightMode}
          isActive={isActive}
          zoom={zoom.value}
          onInitialized={onInitialized}
          onError={onError}
          enableDepthData={true}
          enableZoomGesture={true}
          photo={true}
          video={false}
          audio={hasMicrophonePermission}
          frameProcessor={device.supportsParallelVideoProcessing ? undefined : undefined}
          frameProcessorFps={1}
          onFrameProcessorPerformanceSuggestionAvailable={onFrameProcessorSuggestionAvailable}
        />
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
          <TouchableOpacity style={styles.button} onPress={() => { false ? setIs60Fps(!is60Fps) : undefined }}>
            <Text style={styles.text}>
              {is60Fps ? '60' : '30'}
              {'\n'}FPS
            </Text>
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
  }
});