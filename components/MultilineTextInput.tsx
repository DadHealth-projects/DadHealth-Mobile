import React, { forwardRef, useCallback, useRef } from 'react';
import {
  Keyboard,
  TextInput,
  type TextInputProps,
} from 'react-native';

type Props = TextInputProps & {
  className?: string;
};

const MultilineTextInput = forwardRef<TextInput, Props>(
  function MultilineTextInput(
    { className, onSubmitEditing, ...props },
    forwardedRef,
  ) {
    const inputRef = useRef<TextInput>(null);

    const attachRef = useCallback(
      (input: TextInput | null) => {
        inputRef.current = input;

        if (typeof forwardedRef === 'function') {
          forwardedRef(input);
        } else if (forwardedRef) {
          forwardedRef.current = input;
        }
      },
      [forwardedRef],
    );

    return (
      <TextInput
        {...props}
        ref={attachRef}
        multiline
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={(event) => {
          inputRef.current?.blur();
          Keyboard.dismiss();
          onSubmitEditing?.(event);
        }}
        className={className}
      />
    );
  },
);

export default MultilineTextInput;