import React, {useState} from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  PermissionsAndroid,
  Pressable,
  Text,
  StyleSheet,
} from 'react-native';

import galleryImage from './assets/icons/gallery.png';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
// import Button from './components/Button';
const App = () => {
  const [responseCamera, setResponseCamera] = useState<any>(null);
  const [responseGallery, setResponseGallery] = useState<any>(null);
  console.log('responseCamera', responseCamera);

  const [filePath, setFilePath] = useState('');
  const [imageFilePath, setImageFilePath] = useState<any>('');

  // if (filePath.assets[0].base64 === '') {
  //   return;
  // } else {
  //   console.log('filePath', filePath.assets[0].base64);
  // }

  // console.log('filePath', filePath);

  const openCameraWithPermission = async () => {
    try {
      console.log('i am here');
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'App Camera Permission',
          message: 'App needs access to your camera ',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        launchCamera(
          {
            mediaType: 'photo',
            includeBase64: true,
            maxHeight: 300,
            maxWidth: 500,
          },
          (response: any) => {
            setResponseCamera(response);
            setResponseGallery(null);
            // setFilePath(response.assets[0].base64);
            setFilePath(response.assets[0].uri);
          },
        );
      } else {
        console.log('Camera permission denied');
      }
    } catch (err) {
      console.warn(err);
    }
  };

  // const fileSet = (response: any) => {
  //   if (response.didCancel) {
  //     return;
  //   } else if (response.errorCode === 'camera_unavailable') {
  //     Alert.alert('Camera not available ');
  //     return;
  //   } else if (response.errorCode === 'permission') {
  //     Alert.alert('Permission not satisfied');
  //     return;
  //   } else if (response.errorCode === 'others') {
  //     Alert.alert(response.errorMessage);
  //     return;
  //   }
  //   setFilePath(response.assets[0].uri);
  // };

  // console.log('fileSet ===========', fileSet);

  // const base64Icon = `${filePath}`;

  // console.log('base64Icon ========== ', base64Icon);

  console.log('filePath', filePath);

  console.log('imageFilePath', imageFilePath);

  return (
    <View>
      <View>
        {filePath && (
          <Image source={{uri: filePath}} style={styles.onScreenImage} />
        )}
      </View>

      <Pressable
        style={styles.buttonMainContainer}
        onPress={openCameraWithPermission}>
        {responseCamera === null ? (
          <View style={styles.buttonWrapper}>
            <Text style={styles.buttonText}>OPEN CAMERA</Text>
          </View>
        ) : (
          <Image source={{uri: responseCamera.uri}} />
        )}
      </Pressable>
      <View style={styles.imageScreenCOntainer}>
        <Text style={styles.imageText}>Pic Image From Gallery</Text>
        <TouchableOpacity
          onPress={() =>
            launchImageLibrary(
              {
                mediaType: 'photo',
                includeBase64: true,
                maxHeight: 200,
                maxWidth: 200,
              },
              response => {
                setResponseGallery(response);
                setResponseCamera(null);
                setImageFilePath(response.assets[0].uri);
              },
            )
          }>
          {responseGallery === null ? (
            <Image source={galleryImage} style={styles.imageShower} />
          ) : (
            <Image source={{uri: responseGallery.uri}} />
          )}
        </TouchableOpacity>
        {imageFilePath && (
          <Image source={{uri: imageFilePath}} style={styles.onScreenImage} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  onScreenImage: {
    width: '100%',
    height: 300,
  },
  buttonWrapper: {
    height: 40,
    backgroundColor: '#5271cf',

    justifyContent: 'center',
    borderRadius: 15,
  },
  buttonText: {
    alignItems: 'center',
    textAlign: 'center',
  },
  buttonMainContainer: {
    marginHorizontal: 90,
    marginVertical: 50,
    overflow: 'hidden',
  },
  imageShower: {
    width: 100,
    height: 50,
  },
  imageScreenCOntainer: {
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
  },
  imageText: {
    color: 'black',
    margin: 20,
    fontWeight: 'bold',
    fontSize: 16,
  },
});
export default App;
