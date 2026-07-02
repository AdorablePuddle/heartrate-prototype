import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Camera, useCameraDevice, useCameraPermission, useFrameOutput } from "react-native-vision-camera";

export default function Index() {
	const { hasPermission, requestPermission } = useCameraPermission();
	const device = useCameraDevice("back");

	useEffect(() => {
		if (!hasPermission) requestPermission();
	}, [hasPermission, requestPermission]);

	const frameOutput = useFrameOutput({
		pixelFormat : "rgb",
		onFrame(frame) {
			'worklet'
			try {
				const buffer = frame.getPixelBuffer();
			} finally {
				frame.dispose();
			}
		}
	})

	if (device)
		return (
			<Camera 
				style = {{flex : 1}}
				isActive = {true}
				device = "back"
				outputs = {[frameOutput]}
			/>
		);
	else {
		return (
			<View style = {styles.container}>
				<Text>Camera not found :(</Text>
			</View>
		)
	}
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	camera_hider: {
		
	},
});
