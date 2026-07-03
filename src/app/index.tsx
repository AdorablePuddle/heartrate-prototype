import { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { useAsyncRunner, useCamera, useCameraDevice, useCameraPermission, useFrameOutput } from "react-native-vision-camera";
import { createSynchronizable } from "react-native-worklets";

export default function Index() {
	const [isMeasuring, setIsMeasuring] = useState(false);
	const [currentHeartrate, setCurrentHeartrate] = useState(0);
	
	/*
	const frameValues = useRef<number[]>([]);
	const timestamps  = useRef<number[]>([]);
	*/
	
	const synchronizableRFrameValues = createSynchronizable<number[]>([]);
	const synchronizableGFrameValues = createSynchronizable<number[]>([]);
	const synchronizableBFrameValues = createSynchronizable<number[]>([]);
	const synchronizableTimestamps  = createSynchronizable<number[]>([]);

	const { hasPermission, requestPermission } = useCameraPermission();
	const device = useCameraDevice("back");
	const asyncRunner = useAsyncRunner();

	useEffect(() => {
		if (!hasPermission) requestPermission();
	}, [hasPermission, requestPermission]);

	/*
	const measurement = (avgRed : number, frameTiming : number) => {
		'worklet'
		frameValues.current.push(avgRed);
		timestamps.current.push(frameTiming);

		while (timestamps.current[0] < frameTiming - 5000) { // Delete anything that exists more than 5 seconds ago.
			frameValues.current.shift();
			timestamps.current.shift();
		}
	}
	*/

	/*
	const frameOutput = useFrameOutput({
		pixelFormat : "rgb",
		onFrame(frame) {
			'worklet'
			const wasHandled = asyncRunner.runAsync(() => {
				'worklet'
				// console.log(`Received ${frame.width}x${frame.height} Frame!`);
				try {
					const frameTiming = Date.now();
					const buffer = frame.getPixelBuffer();
					const pixels = new Uint8Array(buffer);

					// const firstPixel = {a: pixels[3], r : pixels[2], g : pixels[1], b : pixels[0]}
					var totalRed = 0;
					var total = 0;
					for (var i = 0; i + 3 < pixels.length; i += 4) {
						const currentRed = pixels[i + 2];
						total += 1;
						totalRed += currentRed;
					}
					runOnJS(measurement)((total > 0)? totalRed / total : 0, frameTiming);
				} catch (error) {
					console.error(`Frame Processing Error: ${error}`)
				} finally {
					frame.dispose();
				}
			});
			if (!wasHandled) {
				frame.dispose();
			}
		}
	})
	*/
	/*
	const frameOutput = useFrameOutput({
		pixelFormat : "rgb",
		onFrame(frame) {
			'worklet'
			// console.log(`Received ${frame.width}x${frame.height} Frame!`);
			try {
				const frameTiming = Date.now();
				const buffer = frame.getPixelBuffer();
				const pixels = new Uint8Array(buffer);

				// const firstPixel = {a: pixels[3], r : pixels[2], g : pixels[1], b : pixels[0]}
				var totalRed = 0;
				var total = 0;
				for (var i = 0; i + 3 < pixels.length; i += 4) {
					const currentRed = pixels[i + 2];
					total += 1;
					totalRed += currentRed;
				}

				// console.log(`Avg Red: ${(total > 0)? totalRed / total : 0}`)
				// setCurrentAvg((total > 0)? totalRed / total : 0);
				frameValues.current.push((total > 0)? totalRed / total : 0);
				timestamps.current.push(frameTiming);

				while (timestamps.current[0] < frameTiming - 5000) { // Delete anything that exists more than 5 seconds ago.
					frameValues.current.shift();
					timestamps.current.shift();
				}
			} catch (error) {
				console.error(`Frame Processing Error: ${error}`)
			} finally {
				frame.dispose();
			}
		}
	});
	*/

	const frameOutput = useFrameOutput({
		pixelFormat : "rgb",
		onFrame(frame) {
			'worklet'
			try {
				const frameTiming = Date.now();
				const rFrameValuesBlocking = synchronizableRFrameValues.getBlocking();
				const gFrameValuesBlocking = synchronizableGFrameValues.getBlocking();
				const bFrameValuesBlocking = synchronizableBFrameValues.getBlocking();
				const timestampsBlocking  = synchronizableTimestamps.getBlocking();
				const buffer = frame.getPixelBuffer();
				const pixels = new Uint8Array(buffer);

				// const firstPixel = {a: pixels[3], r : pixels[2], g : pixels[1], b : pixels[0]}
				var totalRed = 0;
				var totalGreen = 0;
				var totalBlue = 0;
				var total = 0;
				for (var i = 0; i + 3 < pixels.length; i += 4) {
					total += 1;
					totalRed += pixels[i + 2];
					totalGreen += pixels[i + 1];
					totalBlue += pixels[i + 0];
				}

				// console.log(`Avg Red: ${(total > 0)? totalRed / total : 0}`)
				// setCurrentAvg((total > 0)? totalRed / total : 0);

				synchronizableRFrameValues.setBlocking([...rFrameValuesBlocking, (total > 0)? totalRed / total : 0]);
				synchronizableGFrameValues.setBlocking([...gFrameValuesBlocking, (total > 0)? totalGreen / total : 0]);
				synchronizableBFrameValues.setBlocking([...bFrameValuesBlocking, (total > 0)? totalBlue / total : 0]);
				synchronizableTimestamps.setBlocking([...timestampsBlocking, frameTiming]);
			} catch (error) {
				console.error(`Frame Processing Error: ${error}`)
			} finally {
				frame.dispose();
			}
		}
	});

	// Calculating Heart Rate
	useEffect(() => {
		const intervalId = setInterval(() => {
			const currentRFrameValues = synchronizableRFrameValues.getBlocking();
			const currentGFrameValues = synchronizableGFrameValues.getBlocking();
			const currentBFrameValues = synchronizableBFrameValues.getBlocking();
			const currentTimestamps  = synchronizableTimestamps.getBlocking();
			synchronizableRFrameValues.setBlocking([]);
			synchronizableGFrameValues.setBlocking([]);
			synchronizableBFrameValues.setBlocking([]);
			synchronizableTimestamps.setBlocking([]);

			const data = currentRFrameValues.map((e, i) => [e, currentTimestamps[i]]);
			// SKIP IF EMPTY
			if (data.length == 0) return;
			
			// SKIP IF NOT MEASURING
			if (!isMeasuring) {
				setCurrentHeartrate(0);
				return;
			}

			// Naive Peak Analysis:
			const sorted_data = data.sort((a, b) => a[1] - b[1])
			const endTime = sorted_data[sorted_data.length - 1][1];
			const startTime = (sorted_data[0][1] >= endTime - 5000)? sorted_data[0][1] : endTime - 5000;
			const timeTaken = endTime - startTime; // in MS
			const timeTakenMinutes = (timeTaken / 1000) / 60;

			var localPeaks = 0;
			for (var i = 1; i + 1 < sorted_data.length; i += 1) {
				if (sorted_data[i][1] < startTime) continue;
				localPeaks += (sorted_data[i][0] > sorted_data[i + 1][0] && sorted_data[i][0] > sorted_data[i - 1][0])? 1 : 0;
			}

			const currentBPM = localPeaks / timeTakenMinutes;
			// console.log(`Interval Marker: ${currentBPM}`);
			if (Number.isNaN(currentBPM)) return;
			setCurrentHeartrate(currentBPM);
		}, 5000);

		return () => clearInterval(intervalId);
	});

	const camera = useCamera({
		isActive : true,
		device : device ?? "back",
		outputs : [frameOutput],
		constraints : [
			{ fps : 30 }
		]
	})

	const measureToggler = () => {
		if (!isMeasuring) {
			camera?.setTorchMode("on");
		} else {
			camera?.setTorchMode("off");
		}
		setIsMeasuring(!isMeasuring);
	}

	if (device)
		return (
			<View style = {styles.container}>
				<View style = {styles.data_container}>
					<Text style = {styles.data_title}>Heartrate Monitor Prototype</Text>
					<Button
						onPress = {measureToggler}
						title = {!isMeasuring? "Begin Measuring" : "End Measuring"}
					/>
					<Text style = {styles.data_text}>Note: To begin measurement, cover the back camera with your index finger lightly. Do not press it too tightly, but not too lightly either.</Text>
					<Text style = {styles.data_title}>BPM: {Math.round(currentHeartrate)}</Text>
				</View>
			</View>
		);
	else {
		return (
			<View style = {styles.container}>
				<Text style = {styles.data_title}>Camera not found :(</Text>
			</View>
		)
	}
}

/*
	<View style = {styles.camera_container}>
		<Camera 
			style = {styles.camera_hider}
			isActive = {isMeasuring}
			device = {device}
			outputs = {[frameOutput]}
		/>
	</View>
*/

const styles = StyleSheet.create({
	container: {
		flex : 1,
		flexDirection : "column",
		width : "100%",
		height : "100%",
		backgroundColor : "#333",
	},
	camera_container: {
		flex : 0,
	},
	camera_hider: {
		flex : 1,
		opacity : 0,
	},
	data_container: {
		flex : 1,
		alignItems : "center",
		justifyContent : "center",
	},
	data_title: {
		textAlign : "center",
		color: "#F5A9B8",
		fontWeight: "bold",
		fontSize : 25,
	},
	data_text: {
		textAlign : "center",
		color: "#5BCEFA",
		fontStyle : "italic",
		fontSize : 12,
	}
});
