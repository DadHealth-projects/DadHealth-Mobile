import React, { forwardRef, useCallback, useRef } from 'react';
import {
  Keyboard,
  TextInput,
  type TextInputProps,
  type TextInputInstance,
} from 'react-native';

type Props = TextInputProps & {
  className?: string;
};

const MultilineTextInput = forwardRef<TextInputInstance, Props>(
  function MultilineTextInput(
    { className, onSubmitEditing, ...props },
    forwardedRef,
  ) {
    const inputRef = useRef<TextInputInstance>(null);

    const attachRef = useCallback(
      (input: TextInputInstance | null) => {
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
