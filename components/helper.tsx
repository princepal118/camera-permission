// import {Alert, PermissionsAndroid, Platform} from 'react-native';
// export const requestCameraPermission = async () => {
//   if (Platform.OS === 'android') {
//     try {
//       const granted = await PermissionsAndroid.request(
//         PermissionsAndroid.PERMISSIONS.CAMERA,
//         // {
//         //   title: 'Camera Permission',
//         //   message: 'App needs camera permission',
//         // },
//       );
//       return granted === PermissionsAndroid.RESULTS.GRANTED;
//     } catch (err) {
//       return false;
//     }
//     // eslint-disable-next-line curly
//   } else return true;
// };

// export const requestExternalWritePermission = async () => {
//   if (Platform.OS === 'android') {
//     try {
//       const granted = await PermissionsAndroid.request(
//         PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
//         {
//           title: 'External Storage Write Permission',
//           message: 'App needs write permission',
//         },
//       );
//       return granted === PermissionsAndroid.RESULTS.GRANTED;
//     } catch (err: any) {
//       Alert.alert('Write permission err', err);
//     }
//     return false;
//   } else return true;
// };

import React, {FC, useEffect, useRef, useState} from 'react';
import * as Sentry from '@sentry/react-native';
import {Severity} from '@sentry/types';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Config from 'react-native-config';
import {Camera, useCameraDevices} from 'react-native-vision-camera';
import {useIsFocused, useNavigation} from '@react-navigation/native';
import BarcodeMask from 'react-native-barcode-mask';
import ImageResizer from 'react-native-image-resizer';
import {firstDigit} from '@helpers/GeneralHelpers';
import {HOME} from '@constants/navigation/app-bottom-tab';
import useUser from '@contexts/user';
import Header from '@components/Header';
import SelectDocumentModal from '@components/SelectDocumentModal';
import VerifyAddhar from '@screens/verify-aadhar';
import {EXTRACT_DOCUMENT} from '@constants/api/documents-service';
import ScanIcon from '@assets/svg/ScanIcon';
import {
  Container,
  CameraContainer,
  CameraView,
  Title,
  SubTitle,
  Icon,
} from '@styles/screens/scan-and-add';
import {ExistingDoc, IAadharProps} from '@screens/scan-and-add/data';
import ManualEntryForm from '@components/ManualEntryForm';
import useLoaderContext from '@contexts/loader';
import {ASLI_DOCUMENTS_SERVICE_KEY} from '@constants/api/documents-service';
import VerifyScreen from '@screens/verifying-screen';
import ScanMismatchModal from '@components/ScanMismatchModal';
import ErrorModal from '@components/ErrorModal';
import ExistingDocumentModal from '@components/ExistingDocumentModal';
import VerifyDocuments from '@helpers/VerifyDocuments';
import {DELETE_CREDENTIAL} from '@constants/api';
import {useDelete} from '@hooks/api';
import moment from 'moment';

const inputMinLength = {
  aadharCard: 12,
  panCard: 10,
  drivingLicence: 10,
};

const ScanAndAddScreen: FC<{active: boolean}> = () => {
  const navigation = useNavigation();
  const devices = useCameraDevices();
  const cameraRef = useRef<Camera>(null);
  const isFocused = useIsFocused();
  const [hasPermission, setHasPermission] = React.useState<boolean>(false);
  const [selectedDocument, setDocument] = useState<
    'aadharCard' | 'panCard' | 'drivingLicence'
  >();
  const [showVerifyAadhar, setShowVerifyAadhar] = useState<IAadharProps>();
  const [manualEntryFormActive, setManualEntryFormActive] =
    useState<boolean>(false);
  const [ocrMismatch, setOcrMismatch] = useState(false);
  const [scannedData, setScannedData] = useState();
  const [error, setError] = useState('');
  const [subDescription, setSubDescription] = useState('');
  const [nameCheck, setNameCheck] = useState<boolean>();
  const [dobCheck, setDobCheck] = useState<boolean>();

  const device = devices.back;
  const {setCredentials, credentials, user} = useUser();
  const [enableVerifyingScreen, setEnableVerifyingScreen] = useState(false);

  const {showLoader, hideLoader} = useLoaderContext();
  const [existingDocuments, setExistingDocuments] = useState(false);
  const [existingDocumentsData, setExistingDocumentsData] =
    useState<ExistingDoc>();
  const {mutateAsync: deleteCredentialAsync} = useDelete();

  const onPhotoCaptured = async (ref: any) => {
    showLoader();
    let formData = new FormData();
    const photo = await ref.current.takePhoto({
      flash: 'off',
      skipMetadata: true,
      quality: 0.5,
    });
    formData.append(
      'docType',
      selectedDocument === 'aadharCard'
        ? 'ADHAR'
        : selectedDocument === 'drivingLicence'
        ? 'DRVLC'
        : 'PANCR',
    );

    let optimizedImage;
    await ImageResizer.createResizedImage(
      `file://${photo.path}`,
      1000,
      1000,
      'JPEG',
      100,
    )
      .then(resizedImageUri => {
        optimizedImage = resizedImageUri?.uri;
        // resizeImageUri is the URI of the new image that can now be displayed, uploaded...
      })
      .catch(err => {
        console.error('error on image resizing', err);
      });

    const uriParts = photo.path.split('.');
    const fileType = uriParts[uriParts.length - 1];
    //To solve type issuse: https://github.com/g6ling/React-Native-Tips/issues/1
    formData.append(
      'frontSideDocument',
      JSON.parse(
        JSON.stringify({
          // uri: `file://${photo.path}`,
          uri: optimizedImage,
          type: `image/${fileType}`,
          name: `${uriParts[2]}.${fileType}`,
          mimetype: `image/${fileType}`,
        }),
      ),
    );

    fetch(`${Config.ASLI_DOCUMENTS_SERVICE}${EXTRACT_DOCUMENT}`, {
      method: 'post',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'multipart/form-data',
        'api-key': ASLI_DOCUMENTS_SERVICE_KEY,
      },
      body: formData,
    })
      .then(response => response.json())
      .then((data: any) => {
        hideLoader();
        //check for number, if not found -> trigger manual process.
        if (data && data?.data?.id_number) {
          if (selectedDocument === 'aadharCard') {
            setShowVerifyAadhar(data?.data);
          } else {
            verifyDocument(data?.data, false);
          }
        } else {
          setManualEntryFormActive(true);
        }
        //
        mismatchCheck(data?.data);
      })
      .catch(err => {
        //In case of error -> trigger manual process.
        setManualEntryFormActive(true);
        Sentry.captureMessage(
          `Error while extracting the document ${selectedDocument}, ${err?.message}`,
          Severity.Error,
        );
        hideLoader();
      });
  };

  const mismatchCheck = (data: any) => {
    const isValid = moment(data?.date_of_birth, 'YYYY-MM-DD', true).isValid();
    const dob =
      !isValid && data?.date_of_birth?.includes('DD')
        ? data?.date_of_birth.split(' ')[5] +
          '-' +
          data?.date_of_birth.split(' ')[3] +
          '-' +
          data?.date_of_birth.split(' ')[1]
        : data?.date_of_birth;

    const isValidDate = moment(dob, 'DD-MM-YYYY', true).isValid();

    const dobInfo = isValidDate ? dob : moment(dob).format('DD-MM-YYYY');

    const foundName = credentials?.some(
      item =>
        item?.credentialSubject?.name?.toLowerCase() ===
        data?.name?.toLowerCase(),
    );
    setNameCheck(foundName);

    const foundDob = credentials?.some(item => {
      const DOBCheck = moment(
        item?.credentialSubject?.dateOfBirth,
        'DD-MM-YYYY',
        true,
      ).isValid();

      return (
        item?.credentialSubject?.dateOfBirth === (DOBCheck ? dobInfo : dob)
      );
    });
    setDobCheck(foundDob);
    if (data && credentials?.length && (!foundName || !foundDob)) {
      setScannedData(data);
      setOcrMismatch(true);
    } else if (data && data?.id_number) {
      if (selectedDocument === 'aadharCard') {
        setShowVerifyAadhar(data);
      } else {
        verifyDocument(data);
      }
    } else {
      setManualEntryFormActive(true);
    }
  };

  const verifyDocument = async (data: any, isDelDoc?: boolean) => {
    const selectedDoc = selectedDocument || data?.doc_type;
    if (selectedDoc === 'aadharCard') {
      setManualEntryFormActive(true);
    } else {
      setEnableVerifyingScreen(true);
      try {
        const res = await VerifyDocuments(data, selectedDoc, user);
        if (res?.status && res?.data) {
          await setCredentials(undefined);
          if (isDelDoc) {
            await deleteCredentialAsync({
              url: `${DELETE_CREDENTIAL}${data?.id}`,
              isCloudWallet: true,
            });
          }
          setTimeout(() => navigation.navigate(HOME.SCREEN), 500);
        } else setEnableVerifyingScreen(false);
      } catch (e: any) {
        setEnableVerifyingScreen(false);
        if (existingDocuments) {
          setSubDescription('Please try again.');
          setError('Oops!');
        } else {
          if (firstDigit(e?.response?.status) === 4) {
            setSubDescription('The information is not matching our records');
            setError('Oops!');
          } else if (firstDigit(e?.response?.status) === 5) {
            setSubDescription(
              'The server is down. Your information could not be verified. Please try again later.',
            );
            setError('Oops!');
          }
        }
        console.error(
          `Error: while calling verify documents api , ${e?.message}`,
        );
      }
    }
  };

  useEffect(() => {
    (async () => {
      const cameraPermission = await Camera.getCameraPermissionStatus();
      if (cameraPermission !== 'authorized') {
        const status = await Camera.requestCameraPermission();
        setHasPermission(status === 'authorized');
      } else {
        setHasPermission(cameraPermission === 'authorized');
      }
    })();
  }, []);

  const findDocType = (type: string, v: string) => {
    const creds = credentials?.filter(c => c?.type?.[1] === type);
    if (creds?.[0]?.id) {
      setExistingDocuments(true);
      setExistingDocumentsData({
        id_number:
          creds?.[0]?.credentialSubject?.DLnumber ||
          creds?.[0]?.credentialSubject?.number,
        date_of_birth:
          creds?.[0]?.credentialSubject?.dob ||
          creds?.[0]?.credentialSubject?.dateOfBirth,
        name: creds?.[0]?.credentialSubject?.name,
        id: creds?.[0]?.id,
        doc_type: v,
      });
    } else {
      setDocument(v as any);
    }
  };

  const onDocSelect = (v: string) => {
    switch (v) {
      case 'aadharCard': {
        findDocType('Aadhaar', v);
        break;
      }
      case 'drivingLicence': {
        findDocType('DrivingLicense', v);
        break;
      }
      case 'panCard': {
        findDocType('PAN', v);
        break;
      }
      default:
        break;
    }
  };

  const onExistingDocSelect = async () => {
    await verifyDocument(existingDocumentsData, true);
  };

  return (
    <Container>
      <Header title="Scan and add" />

      {!!device && hasPermission && !!selectedDocument && (
        <CameraContainer>
          <Title>
            Scan&nbsp;
            {selectedDocument === 'aadharCard'
              ? 'Aadhaar Card'
              : selectedDocument === 'drivingLicence'
              ? 'Driving Licence'
              : 'PAN Card'}
          </Title>
          <SubTitle>
            Place ID in front of your phone and click on Scan button
          </SubTitle>
          <CameraView
            ref={cameraRef}
            photo={true}
            device={device}
            isActive={isFocused}
          />

          <BarcodeMask
            outerMaskOpacity={1}
            edgeColor="#FFFFFF"
            height={hp(30)}
            width={wp(90)}
            showAnimatedLine={true}
          />

          <Icon onPress={() => onPhotoCaptured(cameraRef)}>
            <ScanIcon />
          </Icon>
        </CameraContainer>
      )}

      {!selectedDocument && !existingDocuments && (
        <SelectDocumentModal
          visible={!selectedDocument}
          hideModal={() => navigation.goBack()}
          onPress={onDocSelect}
        />
      )}

      {existingDocuments && (
        <ExistingDocumentModal
          visible={existingDocuments}
          hideModal={() => navigation.goBack()}
          backModal={() => {
            setExistingDocuments(false);
          }}
          onPress={onExistingDocSelect}
          selectedDocument={existingDocumentsData?.doc_type}
        />
      )}

      {enableVerifyingScreen && (
        <VerifyScreen
          selectedDocument={existingDocumentsData?.doc_type}
          existingDocuments={existingDocuments}
        />
      )}

      {showVerifyAadhar && (
        <VerifyAddhar
          hideModal={() => setShowVerifyAadhar(undefined)}
          verifyAadharData={showVerifyAadhar}
          selectedDocument={existingDocumentsData?.doc_type}
          existingDocuments={existingDocuments}
          existingAadharCredID={existingDocumentsData?.id}
        />
      )}

      {manualEntryFormActive && (
        <ManualEntryForm
          type={selectedDocument || existingDocumentsData?.doc_type}
          visible={true}
          hide={() => {
            setManualEntryFormActive(false);
          }}
          minLength={inputMinLength[selectedDocument!]}
          onSubmitCallback={data => {
            const doc = 'aadharCard';
            if (
              selectedDocument === doc ||
              existingDocumentsData?.doc_type === doc
            ) {
              setShowVerifyAadhar({clientId: data});
            }
          }}
          existingDocuments={existingDocuments}
        />
      )}
      {ocrMismatch && (
        <ScanMismatchModal
          scannedData={scannedData}
          foundName={nameCheck}
          foundDob={dobCheck}
          selectedDocument={selectedDocument}
          ocr={ocrmismatch => setOcrMismatch(ocrmismatch)}
          verifyDocument={data => verifyDocument(data)}
        />
      )}

      <ErrorModal
        visible={!!error}
        description={error}
        hideModal={() => {
          setError('');
          setSubDescription('');
          setOcrMismatch(false);
        }}
        nextModal={() => {
          setError('');
          setSubDescription('');
          setManualEntryFormActive(true);
        }}
        subDescription={subDescription}
        showButtons={subDescription?.includes('server') ? false : true}
        type={'oops'}
        existingDocuments={existingDocuments}
      />
    </Container>
  );
};

export default ScanAndAddScreen;
