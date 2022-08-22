import {StyleSheet, Text, View} from 'react-native';
import React from 'react';

const Button = ({children}: any) => {
  return (
    <View style={styles.buttonContainer}>
      <Text>{children}</Text>
    </View>
  );
};

export default Button;

const styles = StyleSheet.create({
  buttonContainer: {
    backgroundColor: 'blue',
    width: 100,
    height: 50,
    borderRadius: 12,
    textAlign: 'center',
  },
});
