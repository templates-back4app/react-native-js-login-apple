import React, {useState} from 'react';
import {
  Alert,
  Image,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Parse from 'parse/react-native';
import {useNavigation} from '@react-navigation/native';
import {GoogleSignin} from '@react-native-community/google-signin';
import {
  AccessToken,
  GraphRequest,
  GraphRequestManager,
  LoginManager,
} from 'react-native-fbsdk';
import {
  appleAuth,
  appleAuthAndroid,
} from '@invertase/react-native-apple-authentication';
import jwt_decode from 'jwt-decode';
import Styles from './Styles';

export const UserLogIn = () => {
  const navigation = useNavigation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const doUserLogIn = async function () {
    // Note that this values come from state variables that we've declared before
    const usernameValue = username;
    const passwordValue = password;
    return await Parse.User.logIn(usernameValue, passwordValue)
      .then(async (loggedInUser) => {
        // logIn will throw an error if the user is not verified yet,
        // but it's safer to check again after login
        if (loggedInUser.get('emailVerified') === true) {
          Alert.alert(
            'Success!',
            `User ${loggedInUser.get('username')} has successfully signed in!`,
          );
          // Verify this is in fact the current user
          const currentUser = await Parse.User.currentAsync();
          console.log(loggedInUser === currentUser);
          // Navigation.navigate takes the user to the home screen
          navigation.navigate('Home');
          return true;
        } else {
          await Parse.User.logOut();
          return false;
        }
      })
      .catch((error) => {
        // Error can be caused by wrong parameters or lack of Internet connection.
        // A non-verified user will also cause an error
        Alert.alert('Error!', error.message);
        return false;
      });
  };

  const doUserLogInGoogle = async function () {
    try {
      // Check if your user can sign in using Google on his phone
      await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
      // Retrieve user data from Google
      const userInfo = await GoogleSignin.signIn();
      const googleIdToken = userInfo.idToken;
      const googleUserId = userInfo.user.id;
      const googleEmail = userInfo.user.email;
      const authData = {
        id: googleUserId,
        id_token: googleIdToken,
      };
      // Log in or sign up on Parse using this Google credentials
      let userToLogin = new Parse.User();
      // Set username and email to match google email
      userToLogin.set('username', googleEmail);
      userToLogin.set('email', googleEmail);
      return await userToLogin
        .linkWith('google', {
          authData: authData,
        })
        .then(async (loggedInUser) => {
          // logIn returns the corresponding ParseUser object
          Alert.alert(
            'Success!',
            `User ${loggedInUser.get('username')} has successfully signed in!`,
          );
          // To verify that this is in fact the current user, currentAsync can be used
          const currentUser = await Parse.User.currentAsync();
          console.log(loggedInUser === currentUser);
          // Navigation.navigate takes the user to the screen named after the one
          // passed as parameter
          navigation.navigate('Home');
          return true;
        })
        .catch(async (error) => {
          // Error can be caused by wrong parameters or lack of Internet connection
          Alert.alert('Error!', error.message);
          return false;
        });
    } catch (error) {
      Alert.alert('Error!', error.code);
      return false;
    }
  };

  const doUserLogInFacebook = async function () {
    try {
      // Login using the Facebook login dialog asking form email permission
      return await LoginManager.logInWithPermissions(['email']).then(
        (loginResult) => {
          if (loginResult.isCancelled) {
            console.log('Login cancelled');
            return false;
          } else {
            // Retrieve access token from FBSDK to be able to linkWith Parse
            AccessToken.getCurrentAccessToken().then((data) => {
              const facebookAccessToken = data.accessToken;
              // Callback that will be called after FBSDK successfuly retrieves user email and id from FB
              const responseEmailCallback = async (error, emailResult) => {
                if (error) {
                  console.log('Error fetching data: ' + error.toString());
                } else {
                  // Format authData to provide correctly for Facebook linkWith on Parse
                  const facebookId = emailResult.id;
                  const facebookEmail = emailResult.email;
                  const authData = {
                    id: facebookId,
                    access_token: facebookAccessToken,
                  };
                  // Log in or sign up on Parse using this Facebook credentials
                  let userToLogin = new Parse.User();
                  // Set username and email to match provider email
                  userToLogin.set('username', facebookEmail);
                  userToLogin.set('email', facebookEmail);
                  return await userToLogin
                    .linkWith('facebook', {
                      authData: authData,
                    })
                    .then(async (loggedInUser) => {
                      // logIn returns the corresponding ParseUser object
                      Alert.alert(
                        'Success!',
                        `User ${loggedInUser.get(
                          'username',
                        )} has successfully signed in!`,
                      );
                      // To verify that this is in fact the current user, currentAsync can be used
                      const currentUser = await Parse.User.currentAsync();
                      console.log(loggedInUser === currentUser);
                      // Navigation.navigate takes the user to the screen named after the one
                      // passed as parameter
                      navigation.navigate('Home');
                      return true;
                    })
                    .catch(async (error) => {
                      // Error can be caused by wrong parameters or lack of Internet connection
                      Alert.alert('Error!', error.message);
                      return false;
                    });
                }
              };

              // Formats a FBSDK GraphRequest to retrieve user email
              const emailRequest = new GraphRequest(
                '/me',
                {
                  accessToken: facebookAccessToken,
                  parameters: {
                    fields: {
                      string: 'email',
                    },
                  },
                },
                responseEmailCallback,
              );

              // Start the graph request, which will call the callback after finished
              new GraphRequestManager().addRequest(emailRequest).start();

              return true;
            });
          }
        },
        (error) => {
          console.log('Login fail with error: ' + error);
          return false;
        },
      );
    } catch (error) {
      Alert.alert('Error!', error.code);
      return false;
    }
  };

  const doUserLogInApple = async function () {
    try {
      let response = {};
      let appleId = '';
      let appleToken = '';
      let appleEmail = '';
      if (Platform.OS === 'ios') {
        // Performs login request requesting user email
        response = await appleAuth.performRequest({
          requestedOperation: appleAuth.Operation.LOGIN,
          requestedScopes: [appleAuth.Scope.EMAIL],
        });
        // On iOS, user ID and email are easily retrieved from request
        appleId = response.user;
        appleToken = response.identityToken;
        appleEmail = response.email;
      } else if (Platform.OS === 'android') {
        // Configure the request
        appleAuthAndroid.configure({
          // The Service ID you registered with Apple
          clientId: 'YOUR_SERVICE_ID',
          // Return URL added to your Apple dev console
          redirectUri: 'YOUR_SERVICE_URL',
          responseType: appleAuthAndroid.ResponseType.ALL,
          scope: appleAuthAndroid.Scope.ALL,
        });
        response = await appleAuthAndroid.signIn();
        // Decode user ID and email from token returned from Apple,
        // this is a common workaround for Apple sign-in via web API
        const decodedIdToken = jwt_decode(response.id_token);
        appleId = decodedIdToken.sub;
        appleToken = response.id_token;
        appleEmail = decodedIdToken.email;
      }
      // Format authData to provide correctly for Apple linkWith on Parse
      const authData = {
        id: appleId,
        token: appleToken,
      };
      // Log in or sign up on Parse using this Apple credentials
      let userToLogin = new Parse.User();
      // Set username and email to match provider email
      userToLogin.set('username', appleEmail);
      userToLogin.set('email', appleEmail);
      return await userToLogin
        .linkWith('apple', {
          authData: authData,
        })
        .then(async (loggedInUser) => {
          // logIn returns the corresponding ParseUser object
          Alert.alert(
            'Success!',
            `User ${loggedInUser.get('username')} has successfully signed in!`,
          );
          // To verify that this is in fact the current user, currentAsync can be used
          const currentUser = await Parse.User.currentAsync();
          console.log(loggedInUser === currentUser);
          // Navigation.navigate takes the user to the screen named after the one
          // passed as parameter
          navigation.navigate('Home');
          return true;
        })
        .catch(async (error) => {
          // Error can be caused by wrong parameters or lack of Internet connection
          Alert.alert('Error!', error.message);
          return false;
        });
    } catch (error) {
      // Error can be caused by wrong parameters or lack of Internet connection
      Alert.alert('Error!', error);
      return false;
    }
  };

  return (
    <View style={Styles.login_wrapper}>
      <View style={Styles.form}>
        <TextInput
          style={Styles.form_input}
          value={username}
          placeholder={'Username'}
          onChangeText={(text) => setUsername(text)}
          autoCapitalize={'none'}
          keyboardType={'email-address'}
        />
        <TextInput
          style={Styles.form_input}
          value={password}
          placeholder={'Password'}
          secureTextEntry
          onChangeText={(text) => setPassword(text)}
        />
        <TouchableOpacity onPress={() => doUserLogIn()}>
          <View style={Styles.button}>
            <Text style={Styles.button_label}>{'Sign in'}</Text>
          </View>
        </TouchableOpacity>
      </View>
      <View style={Styles.login_social}>
        <View style={Styles.login_social_separator}>
          <View style={Styles.login_social_separator_line} />
          <Text style={Styles.login_social_separator_text}>{'or'}</Text>
          <View style={Styles.login_social_separator_line} />
        </View>
        <View style={Styles.login_social_buttons}>
          <TouchableOpacity onPress={() => doUserLogInFacebook()}>
            <View
              style={[
                Styles.login_social_button,
                Styles.login_social_facebook,
              ]}>
              <Image
                style={Styles.login_social_icon}
                source={require('./assets/icon-facebook.png')}
              />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => doUserLogInGoogle()}>
            <View style={Styles.login_social_button}>
              <Image
                style={Styles.login_social_icon}
                source={require('./assets/icon-google.png')}
              />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => doUserLogInApple()}>
            <View style={Styles.login_social_button}>
              <Image
                style={Styles.login_social_icon}
                source={require('./assets/icon-apple.png')}
              />
            </View>
          </TouchableOpacity>
        </View>
      </View>
      <>
        <TouchableOpacity onPress={() => navigation.navigate('Sign Up')}>
          <Text style={Styles.login_footer_text}>
            {"Don't have an account? "}
            <Text style={Styles.login_footer_link}>{'Sign up'}</Text>
          </Text>
        </TouchableOpacity>
      </>
    </View>
  );
};
