import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PinInput } from './pin-input';

describe('PinInput', () => {
  let component: PinInput;
  let fixture: ComponentFixture<PinInput>;
  let boxes: HTMLInputElement[];

  const type = (index: number, text: string) => {
    boxes[index].value = text;
    boxes[index].dispatchEvent(new Event('input'));
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PinInput],
    }).compileComponents();

    fixture = TestBed.createComponent(PinInput);
    component = fixture.componentInstance;
    await fixture.whenStable();
    boxes = Array.from(fixture.nativeElement.querySelectorAll('input'));
  });

  it('visar fyra rutor', () => {
    expect(boxes.length).toBe(4);
  });

  it('samlar siffror och flyttar fokus framåt', () => {
    type(0, '1');
    expect(document.activeElement).toBe(boxes[1]);
    type(1, '2');
    type(2, '3');
    type(3, '4');
    expect(component.value()).toBe('1234');
  });

  it('ignorerar annat än siffror', () => {
    type(0, 'a');
    expect(component.value()).toBe('');
  });
});
