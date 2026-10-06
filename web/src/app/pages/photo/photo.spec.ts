import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Photo } from './photo';

describe('Photo', () => {
  let component: Photo;
  let fixture: ComponentFixture<Photo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Photo],
    }).compileComponents();

    fixture = TestBed.createComponent(Photo);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
